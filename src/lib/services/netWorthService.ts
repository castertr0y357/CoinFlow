import prisma from "@/lib/prisma";

function safeNumber(val: any): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export async function getNetWorthData() {
  const accounts = await prisma.account.findMany({
    orderBy: { name: "asc" }
  });

  const transactions = await prisma.transaction.findMany({
    orderBy: { date: "desc" },
    select: {
      accountId: true,
      amount: true,
      date: true
    }
  });

  const mortgage = await prisma.mortgageDetail.findFirst();
  const homeValue = mortgage?.homeValue ? safeNumber(mortgage.homeValue) : 0;

  // 1. Group accounts by asset vs debt
  // Asset: !isDebt, Debt: isDebt
  const currentAssets = accounts
    .filter(a => !a.isDebt && !a.excludeFromAssetCalculation)
    .reduce((sum, a) => sum + safeNumber(a.balance), 0) + homeValue;

  const currentDebts = accounts
    .filter(a => a.isDebt && !a.excludeFromAssetCalculation)
    .reduce((sum, a) => sum + Math.abs(safeNumber(a.balance)), 0);

  const currentNetWorth = currentAssets - currentDebts;

  // 2. Generate historical net worth for the last 6 months (including current month)
  // We'll calculate the value at the end of each month.
  const history: { monthName: string; assets: number; debts: number; netWorth: number }[] = [];
  const today = new Date();

  for (let i = 5; i >= 0; i--) {
    // End of that historical month
    const d = new Date(today.getFullYear(), today.getMonth() - i + 1, 0, 23, 59, 59, 999);
    
    let monthAssets = homeValue; // Start with property value asset (assumed constant)
    let monthDebts = 0;

    for (const acc of accounts) {
      if (acc.excludeFromAssetCalculation) continue;

      const balance = safeNumber(acc.balance);
      
      // Sum transactions in this account that happened AFTER this month-end
      const sumAfter = transactions
        .filter(t => t.accountId === acc.id && t.date.getTime() > d.getTime())
        .reduce((sum, t) => sum + safeNumber(t.amount), 0);

      const histBalance = balance - sumAfter;

      if (acc.isDebt) {
        monthDebts += Math.abs(histBalance);
      } else {
        monthAssets += histBalance;
      }
    }

    const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    history.push({
      monthName: monthLabel,
      assets: Math.round(monthAssets),
      debts: Math.round(monthDebts),
      netWorth: Math.round(monthAssets - monthDebts)
    });
  }

  return {
    currentNetWorth,
    totalAssets: currentAssets,
    totalDebts: currentDebts,
    homeValue,
    history,
    accounts: accounts.map(a => ({
      id: a.id,
      name: a.name,
      balance: safeNumber(a.balance),
      type: a.type || "Other",
      excludeFromSurplus: a.excludeFromSurplus,
      isDebt: a.isDebt,
      showInSidebar: a.showInSidebar,
      excludeFromAssetCalculation: a.excludeFromAssetCalculation
    }))
  };
}
