import prisma from "@/lib/prisma";
import { runMonthlyProvisioning } from "./provisioning";

function safeNumber(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export async function getMonthlyTally(year?: number) {
  const currentYear = year || new Date().getFullYear();
  
  // 0. Run lazy provisioning
  await runMonthlyProvisioning(currentYear);

  // 1. Get the current active budget year
  let budgetYear = await prisma.budgetYear.findUnique({
    where: { year: currentYear }
  });

  if (!budgetYear) {
    budgetYear = await prisma.budgetYear.create({
      data: { year: currentYear }
    });
  }

  // 2. Sum up ALL transaction splits for this year
  // ONLY include categories that have a config for this specific year
  const categories = await prisma.category.findMany({
    orderBy: [
      { displayOrder: 'asc' },
      { name: 'asc' }
    ],
    include: {
      configs: {
        where: { yearId: budgetYear.id }
      },
      tiedAccount: {
        select: {
          excludeFromSurplus: true
        }
      },
      splits: {
        where: {
          transaction: {
            date: {
              gte: new Date(currentYear, 0, 1),
              lte: new Date(currentYear, 11, 31)
            }
          }
        }
      }
    }
  });

  const categoryTallies = categories.map(c => {
    const config = c.configs[0];
    const rollover = safeNumber(config?.rollover);
    const monthlyBudget = safeNumber(config?.monthlyBudget);
    
    // Provisions are positive amounts (deposits/allocations)
    // Spending are negative amounts (purchases)
    const provisions = c.splits
      .filter(s => safeNumber(s.amount) > 0)
      .reduce((acc, s) => acc + safeNumber(s.amount), 0);
      
    const spending = c.splits
      .filter(s => safeNumber(s.amount) < 0)
      .reduce((acc, s) => acc + Math.abs(safeNumber(s.amount)), 0);

    const remaining = rollover + provisions - spending;

    return {
      id: c.id,
      name: c.name,
      budget: monthlyBudget,
      provisions: safeNumber(provisions),
      rollover: rollover,
      spent: safeNumber(spending),
      remaining: safeNumber(remaining),
      tiedAccountId: c.tiedAccountId,
      isOffBudget: !!c.tiedAccount?.excludeFromSurplus,
      isPaused: c.isPaused
    };
  });

  const onBudgetTallies = categoryTallies.filter(c => !c.isOffBudget);
  const totalBudgeted = onBudgetTallies.reduce((acc, c) => acc + c.budget, 0);
  const currentTally = onBudgetTallies.reduce((acc, c) => acc + c.remaining, 0);

  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
  
  let savingsTarget = safeNumber(settings?.savingsTarget || 650);
  
  if (settings?.savingsCategoryId) {
    const savingsConfig = await prisma.yearlyCategory.findUnique({
      where: {
        yearId_categoryId: {
          yearId: budgetYear.id,
          categoryId: settings.savingsCategoryId
        }
      }
    });
    if (savingsConfig) {
      savingsTarget = safeNumber(savingsConfig.monthlyBudget);
    }
  }

  const accounts = await prisma.account.findMany();
  const inclusionAccounts = accounts.filter(a => !a.excludeFromSurplus);

  // Liquid Cash = Accounts NOT marked as debt
  // Credit Debt = Accounts marked as debt
  const liquidCash = inclusionAccounts
    .filter(a => !a.isDebt)
    .reduce((acc, a) => acc + safeNumber(a.balance), 0);
  
  const creditDebt = inclusionAccounts
    .filter(a => a.isDebt)
    .reduce((acc, a) => acc + Math.abs(safeNumber(a.balance)), 0);

  const totalObligations = safeNumber(currentTally);
  const finalSurplus = liquidCash - totalObligations - creditDebt;

  // 4. Integrity Checks
  const integrityWarnings: { accountId?: string; message: string; severity: 'warning' | 'danger' }[] = [];
  
  for (const account of inclusionAccounts) {
    if (account.isDebt) continue;

    const tiedCats = categoryTallies.filter(t => t.tiedAccountId === account.id);
    if (tiedCats.length > 0) {
      const totalTiedObligation = tiedCats.reduce((acc, t) => acc + t.remaining, 0);
      if (totalTiedObligation > safeNumber(account.balance)) {
        integrityWarnings.push({
          accountId: account.id,
          message: `${account.name} doesn't have enough cash to cover its tied categories!`,
          severity: 'danger'
        });
      }
    }
  }

  if (finalSurplus < 0) {
    integrityWarnings.push({
      message: "Global Surplus is negative. You are over-allocated across all accounts.",
      severity: 'warning'
    });
  }

  // 5. Forecast
  const expectedIncome = safeNumber(settings?.monthlyIncome || 5000);
  const forecast = {
    expectedIncome,
    projectedMonthEnd: finalSurplus + expectedIncome,
    isHealthy: (finalSurplus + expectedIncome) > 0
  };

  return {
    year: currentYear,
    savingsTarget: savingsTarget,
    totalBudgeted: safeNumber(totalBudgeted),
    totalBankBalances: liquidCash - creditDebt,
    liquidCash: safeNumber(liquidCash),
    creditDebt: safeNumber(creditDebt),
    totalObligations: safeNumber(totalObligations),
    finalSurplus: safeNumber(finalSurplus),
    integrityWarnings,
    forecast,
    lastSync: settings?.lastSync,
    categories: categoryTallies,
    accounts: accounts.map(a => ({ 
      id: a.id,
      name: a.name, 
      balance: safeNumber(a.balance),
      type: a.type || 'Other',
      excludeFromSurplus: a.excludeFromSurplus,
      isDebt: a.isDebt
    }))
  };
}

async function initializeYear(year: number) {
  const budgetYear = await prisma.budgetYear.create({
    data: { year }
  });

  const categories = await prisma.category.findMany();
  
  for (const cat of categories) {
    await prisma.yearlyCategory.create({
      data: {
        yearId: budgetYear.id,
        categoryId: cat.id,
        monthlyBudget: 0,
        rollover: 0
      }
    });
  }

  return prisma.budgetYear.findUniqueOrThrow({
    where: { id: budgetYear.id },
    include: { configs: true }
  });
}

export async function getBudgetSettings() {
  return prisma.settings.findUnique({ where: { id: 'global' } });
}

export async function updateBudgetSettings(target: number, income: number, simpleFinToken?: string | null) {
  return prisma.settings.upsert({
    where: { id: 'global' },
    update: {
      savingsTarget: target,
      monthlyIncome: income,
      simpleFinToken: simpleFinToken || null,
    },
    create: {
      id: 'global',
      savingsTarget: target,
      monthlyIncome: income,
      simpleFinToken: simpleFinToken || null,
    }
  });
}

export async function getSidebarData() {
  const accounts = await prisma.account.findMany({
    orderBy: { name: 'asc' }
  });
  
  return accounts.map(a => ({
    id: a.id,
    name: a.name,
    balance: safeNumber(a.balance),
    type: a.type || 'Other',
    excludeFromSurplus: a.excludeFromSurplus,
    isDebt: a.isDebt
  }));
}
