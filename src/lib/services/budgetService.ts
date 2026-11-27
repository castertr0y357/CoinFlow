import prisma from "@/lib/prisma";
import { runMonthlyProvisioning } from "./provisioning";
import { Transaction } from "@prisma/client";

export interface PaycheckForecastItem {
  date: string;
  amount: number;
  status: "received" | "pending";
}

export interface BudgetForecast {
  expectedIncome: number;
  projectedMonthEnd: number;
  isHealthy: boolean;
  paycheckEnabled: boolean;
  paychecks: PaycheckForecastItem[];
  remainingIncome: number;
  nextMonthAllocations: number;
  nextMonthCommitments: number;
  nextMonthSurplus: number;
}

function safeNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export async function getMonthlyTally(year?: number) {
  const currentYear = year || new Date().getFullYear();
  
  const now = new Date();
  const isHistoricalYear = currentYear < now.getFullYear();

  // 0. Run lazy provisioning only for current/future years (never mutate historical archives)
  if (!isHistoricalYear) {
    await runMonthlyProvisioning(currentYear);
  }

  // 1. Get the current active budget year
  let budgetYear = await prisma.budgetYear.findUnique({
    where: { year: currentYear }
  });

  if (!budgetYear) {
    budgetYear = await prisma.budgetYear.create({
      data: { year: currentYear }
    });
  }

  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
  const targetMonth = currentYear === now.getFullYear() ? now.getMonth() : 11;
  const monthStart = new Date(currentYear, targetMonth, 1);
  const monthEnd = new Date(currentYear, targetMonth + 1, 0, 23, 59, 59, 999);

  // 2. Fetch categories, DB-aggregated split sums, and independent settings/accounts in parallel
  const [
    categories,
    provisionGroups,
    spendingGroups,
    monthSpendingGroups,
    settings,
    accounts,
    commitments,
  ] = await Promise.all([
    prisma.category.findMany({
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
        commitments: true,
      }
    }),
    prisma.transactionSplit.groupBy({
      by: ['categoryId'],
      where: {
        categoryId: { not: null },
        amount: { gt: 0 },
        transaction: { date: { gte: yearStart, lte: yearEnd } }
      },
      _sum: { amount: true }
    }),
    prisma.transactionSplit.groupBy({
      by: ['categoryId'],
      where: {
        categoryId: { not: null },
        amount: { lt: 0 },
        transaction: { date: { gte: yearStart, lte: yearEnd } }
      },
      _sum: { amount: true }
    }),
    prisma.transactionSplit.groupBy({
      by: ['categoryId'],
      where: {
        categoryId: { not: null },
        transaction: {
          date: { gte: monthStart, lte: monthEnd },
          NOT: { payee: { startsWith: "Month Start Provision" } }
        }
      },
      _sum: { amount: true }
    }),
    prisma.settings.findUnique({ where: { id: 'global' } }),
    prisma.account.findMany(),
    prisma.commitment.findMany(),
  ]);

  const provisionsByCat = new Map<string, number>();
  for (const g of provisionGroups) {
    if (g.categoryId) provisionsByCat.set(g.categoryId, safeNumber(g._sum.amount));
  }

  const spendingByCat = new Map<string, number>();
  for (const g of spendingGroups) {
    if (g.categoryId) spendingByCat.set(g.categoryId, Math.abs(safeNumber(g._sum.amount)));
  }

  const monthSpendingByCat = new Map<string, number>();
  for (const g of monthSpendingGroups) {
    if (g.categoryId) {
      // Negative net sum means outflow; positive refunds reduce net spending
      const net = safeNumber(g._sum.amount);
      monthSpendingByCat.set(g.categoryId, net < 0 ? Math.abs(net) : 0);
    }
  }

  const visibleCategories = categories.filter((c) => {
    if (!c.isArchived) return true;
    const hasActivity =
      (spendingByCat.get(c.id) || 0) > 0 ||
      (provisionsByCat.get(c.id) || 0) > 0 ||
      c.configs.length > 0;
    // In historical views, show archived categories that have data in that year.
    // In current/future years, hide archived categories unless they have actual spending this year.
    return isHistoricalYear ? hasActivity : (spendingByCat.get(c.id) || 0) > 0;
  });

  const categoryTallies = visibleCategories.map(c => {
    const config = c.configs[0];
    const rollover = safeNumber(config?.rollover);
    const monthlyBudget = safeNumber(config?.monthlyBudget);
    
    // Calculate monthly equivalent commitments for this category
    const categoryCommitments = c.commitments?.reduce((acc, comm) => {
      let monthly = safeNumber(comm.amount);
      if (comm.frequency === "YEARLY") monthly = monthly / 12;
      else if (comm.frequency === "SEMI_ANNUAL") monthly = monthly / 6;
      else if (comm.frequency === "QUARTERLY") monthly = monthly / 3;
      return acc + monthly;
    }, 0) || 0;
    
    const provisions = provisionsByCat.get(c.id) || 0;
    const spending = spendingByCat.get(c.id) || 0;
    const remaining = rollover + provisions - spending;

    const today = new Date();
    let monthsCount = 12;
    if (currentYear === today.getFullYear()) {
      monthsCount = today.getMonth() + 1; // 1-based current month
    } else if (currentYear > today.getFullYear()) {
      monthsCount = 1;
    }
    const averageSpent = monthsCount > 0 ? (spending / monthsCount) : 0;

    return {
      id: c.id,
      name: c.name,
      budget: monthlyBudget,
      provisions: safeNumber(provisions),
      rollover: rollover,
      spent: parseFloat(averageSpent.toFixed(2)),
      totalSpent: safeNumber(spending),
      spentThisMonth: parseFloat((monthSpendingByCat.get(c.id) || 0).toFixed(2)),
      remaining: safeNumber(remaining),
      tiedAccountId: c.tiedAccountId,
      isOffBudget: !!c.tiedAccount?.excludeFromSurplus,
      isPaused: c.isPaused,
      commitments: safeNumber(categoryCommitments)
    };
  });

  const onBudgetTallies = categoryTallies.filter(c => !c.isOffBudget);
  const totalBudgeted = onBudgetTallies.reduce((acc, c) => acc + c.budget, 0);
  const currentTally = onBudgetTallies.reduce((acc, c) => acc + c.remaining, 0);
  
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

  const inclusionAccounts = accounts.filter(a => !a.excludeFromSurplus && a.showInSidebar);

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
  const nextMonthCommitments = commitments.reduce((acc, c) => {
    let monthly = safeNumber(c.amount);
    if (c.frequency === "YEARLY") monthly = monthly / 12;
    else if (c.frequency === "SEMI_ANNUAL") monthly = monthly / 6;
    else if (c.frequency === "QUARTERLY") monthly = monthly / 3;
    return acc + monthly;
  }, 0);

  const nextMonthAllocations = safeNumber(totalBudgeted);
  const expectedIncome = safeNumber(settings?.monthlyIncome || 5000);
  const defaultMonthEndBuffer = finalSurplus + expectedIncome;
  // We no longer subtract nextMonthCommitments from the next month surplus!
  const defaultNextMonthSurplus = defaultMonthEndBuffer - nextMonthAllocations;

  let forecast: BudgetForecast = {
    expectedIncome,
    projectedMonthEnd: defaultMonthEndBuffer,
    isHealthy: defaultNextMonthSurplus >= 0,
    paycheckEnabled: false,
    paychecks: [],
    remainingIncome: expectedIncome,
    nextMonthAllocations,
    nextMonthCommitments,
    nextMonthSurplus: defaultNextMonthSurplus
  };

  if (settings?.paycheckEnabled && settings?.paycheckNextDate) {
    const paycheckAmount = safeNumber(settings.paycheckAmount);
    const frequency = settings.paycheckFrequency || "BI_WEEKLY";
    const refDate = new Date(settings.paycheckNextDate);
    
    const today = new Date();
    const isCurrentYear = currentYear === today.getFullYear();
    const todayMonth = today.getMonth();
    
    if (isCurrentYear) {
      // 1. Generate all paycheck dates for the current month
      const paycheckDates = getPaycheckDatesInMonth(currentYear, todayMonth, frequency, refDate);
      
      // 2. Fetch all positive transactions in the current month to match against
      const startOfMonth = new Date(currentYear, todayMonth, 1);
      const endOfMonth = new Date(currentYear, todayMonth + 1, 0, 23, 59, 59, 999);
      
      const monthInflows = await prisma.transaction.findMany({
        where: {
          date: {
            gte: startOfMonth,
            lte: endOfMonth
          },
          amount: {
            gt: 0
          }
        }
      });
      
      // 3. Evaluate each scheduled paycheck
      const paycheckList: { date: string; amount: number; status: "received" | "pending" }[] = [];
      let totalRemainingIncome = 0;
      let totalExpectedIncome = 0;
      
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      
      for (const pDate of paycheckDates) {
        const pTime = pDate.getTime();
        const isMatched = await hasReceivedPaycheck(paycheckAmount, pDate, monthInflows);
        let status: "received" | "pending" = "pending";
        
        if (isMatched) {
          status = "received";
        } else if (pTime < todayMidnight) {
          status = "received";
        } else {
          status = "pending";
        }
        
        paycheckList.push({
          date: pDate.toISOString().split('T')[0],
          amount: paycheckAmount,
          status
        });
        
        totalExpectedIncome += paycheckAmount;
        if (status === "pending") {
          totalRemainingIncome += paycheckAmount;
        }
      }
      
      const monthEndBuffer = finalSurplus + totalRemainingIncome;
      // We no longer subtract nextMonthCommitments from the next month surplus!
      const nextMonthSurplus = monthEndBuffer - nextMonthAllocations;

      forecast = {
        expectedIncome: totalExpectedIncome,
        projectedMonthEnd: monthEndBuffer,
        isHealthy: nextMonthSurplus >= 0,
        paycheckEnabled: true,
        paychecks: paycheckList,
        remainingIncome: totalRemainingIncome,
        nextMonthAllocations,
        nextMonthCommitments,
        nextMonthSurplus
      };
    }
  }

  // 6. Query inbox transactions waiting for review
  const inboxWhere = {
    isHidden: false,
    account: {
      excludeFromSurplus: false,
      showTransactions: true
    },
    splits: {
      some: {
        categoryId: null
      }
    }
  };

  const inboxCount = await prisma.transaction.count({
    where: inboxWhere
  });

  const inboxSplits = await prisma.transactionSplit.aggregate({
    where: {
      categoryId: null,
      transaction: inboxWhere
    },
    _sum: {
      amount: true
    }
  });

  const inboxTotal = Number(inboxSplits._sum.amount || 0);

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
    inbox: {
      count: inboxCount,
      total: inboxTotal
    },
    lastSync: settings?.lastSync,
    categories: categoryTallies,
    accounts: accounts.map(a => ({ 
      id: a.id,
      name: a.name, 
      displayName: a.displayName,
      balance: safeNumber(a.balance),
      type: a.type || 'Other',
      excludeFromSurplus: a.excludeFromSurplus,
      isDebt: a.isDebt,
      showInSidebar: a.showInSidebar,
      excludeFromAssetCalculation: a.excludeFromAssetCalculation,
      showTransactions: a.showTransactions,
      syncError: a.syncError,
      muteSyncErrors: a.muteSyncErrors
    }))
  };
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
    displayName: a.displayName,
    balance: safeNumber(a.balance),
    type: a.type || 'Other',
    excludeFromSurplus: a.excludeFromSurplus,
    isDebt: a.isDebt,
    showInSidebar: a.showInSidebar,
    excludeFromAssetCalculation: a.excludeFromAssetCalculation,
    showTransactions: a.showTransactions,
    syncError: a.syncError,
    muteSyncErrors: a.muteSyncErrors
  }));
}

export function getPaycheckDatesInMonth(
  year: number,
  month: number, // 0-indexed (0 = Jan, 11 = Dec)
  frequency: string,
  referenceDate: Date
): Date[] {
  const dates: Date[] = [];
  
  // Normalize referenceDate to midnight local
  const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  
  const targetStart = new Date(year, month, 1);
  const targetEnd = new Date(year, month + 1, 0); // Last day of target month

  if (frequency === "MONTHLY") {
    const day = ref.getDate();
    const maxDays = targetEnd.getDate();
    const paycheckDay = Math.min(day, maxDays);
    dates.push(new Date(year, month, paycheckDay));
  } else if (frequency === "SEMI_MONTHLY") {
    const day = ref.getDate();
    if (day <= 15) {
      dates.push(new Date(year, month, day));
      const secondDay = day + 15;
      dates.push(new Date(year, month, secondDay));
    } else {
      const firstDay = day - 15;
      dates.push(new Date(year, month, firstDay));
      const maxDays = targetEnd.getDate();
      const secondDay = Math.min(day, maxDays);
      dates.push(new Date(year, month, secondDay));
    }
  } else if (frequency === "WEEKLY" || frequency === "BI_WEEKLY") {
    const intervalDays = frequency === "WEEKLY" ? 7 : 14;
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    
    // Add reference date if it falls in the target month
    if (ref >= targetStart && ref <= targetEnd) {
      dates.push(new Date(ref));
    }
    
    // Step backward
    let current = new Date(ref.getTime() - intervalMs);
    while (current >= targetStart) {
      if (current <= targetEnd) {
        dates.push(new Date(current));
      }
      current = new Date(current.getTime() - intervalMs);
    }
    
    // Step forward
    current = new Date(ref.getTime() + intervalMs);
    while (current <= targetEnd) {
      if (current >= targetStart) {
        dates.push(new Date(current));
      }
      current = new Date(current.getTime() + intervalMs);
    }
  }
  
  // Sort dates ascending
  return dates.sort((a, b) => a.getTime() - b.getTime());
}

async function hasReceivedPaycheck(
  amount: number,
  date: Date,
  monthTransactions: Transaction[]
): Promise<boolean> {
  const paycheckTime = date.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  
  return monthTransactions.some(t => {
    const txDate = new Date(t.date);
    const txTime = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate()).getTime();
    
    // Date is within ±1 day
    const dateDiff = Math.abs(txTime - paycheckTime);
    const isWithinWindow = dateDiff <= oneDayMs;
    
    // Positive inflow amount close to paycheck amount (within 10% range)
    const tAmt = Number(t.amount);
    const isMatchingAmount = tAmt >= amount * 0.9 && tAmt <= amount * 1.1;
    
    return isWithinWindow && isMatchingAmount;
  });
}
