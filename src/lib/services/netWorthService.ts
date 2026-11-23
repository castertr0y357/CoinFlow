import prisma from "@/lib/prisma";

function safeNumber(val: unknown): number {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export function isInvestmentAccountName(name: string, type?: string | null): boolean {
  const combined = `${name} ${type || ""}`;
  return /401\s*\(?k\)?|ira|roth|brokerage|stock|etf|fidelity|etrade|vanguard|schwab|investment/i.test(combined);
}

export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function recordMonthlyNetWorthSnapshot() {
  const [accounts, mortgages] = await Promise.all([
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.mortgageDetail.findMany(),
  ]);

  const homeValue = mortgages.reduce((sum, m) => {
    const effValue = m.manualHomeValue !== null ? m.manualHomeValue : m.homeValue;
    return sum + (effValue ? safeNumber(effValue) : 0);
  }, 0);

  const includedAssets = accounts.filter(a => !a.isDebt && !a.excludeFromAssetCalculation);
  const currentAssets = includedAssets.reduce((sum, a) => sum + safeNumber(a.balance), 0) + homeValue;
  const investments = includedAssets
    .filter(a => isInvestmentAccountName(a.displayName || a.name, a.type))
    .reduce((sum, a) => sum + safeNumber(a.balance), 0);

  const currentDebts = accounts
    .filter(a => a.isDebt && !a.excludeFromAssetCalculation)
    .reduce((sum, a) => sum + Math.abs(safeNumber(a.balance)), 0);

  const currentNetWorth = currentAssets - currentDebts;
  const monthKey = getMonthKey(new Date());

  await prisma.netWorthSnapshot.upsert({
    where: { monthKey },
    update: {
      assets: currentAssets,
      debts: currentDebts,
      homeValue,
      investments,
      netWorth: currentNetWorth,
    },
    create: {
      monthKey,
      assets: currentAssets,
      debts: currentDebts,
      homeValue,
      investments,
      netWorth: currentNetWorth,
    },
  });

  return { currentAssets, currentDebts, homeValue, investments, currentNetWorth, accounts };
}

export async function getNetWorthData() {
  const { currentAssets, currentDebts, homeValue, currentNetWorth, accounts } =
    await recordMonthlyNetWorthSnapshot();

  const [transactions, snapshots] = await Promise.all([
    prisma.transaction.findMany({
      orderBy: { date: "desc" },
      select: {
        accountId: true,
        amount: true,
        date: true
      }
    }),
    prisma.netWorthSnapshot.findMany(),
  ]);

  const snapshotMap = new Map(snapshots.map(s => [s.monthKey, s]));

  // 2. Generate historical net worth for the last 6 months (including current month)
  const history: { monthName: string; assets: number; debts: number; netWorth: number; isSnapshot: boolean }[] = [];
  const today = new Date();

  for (let i = 5; i >= 0; i--) {
    // End of that historical month
    const d = new Date(today.getFullYear(), today.getMonth() - i + 1, 0, 23, 59, 59, 999);
    const monthKey = getMonthKey(d);
    const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

    const snap = snapshotMap.get(monthKey);
    if (snap) {
      history.push({
        monthName: monthLabel,
        assets: Math.round(safeNumber(snap.assets)),
        debts: Math.round(safeNumber(snap.debts)),
        netWorth: Math.round(safeNumber(snap.netWorth)),
        isSnapshot: true,
      });
      continue;
    }

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
        // Debt accounts may be stored as negative (e.g. -1500) or positive (e.g. 1500)
        const normalizedDebt = balance < 0 ? Math.abs(Math.min(0, histBalance)) : Math.max(0, histBalance);
        monthDebts += normalizedDebt;
      } else {
        monthAssets += histBalance;
      }
    }

    history.push({
      monthName: monthLabel,
      assets: Math.round(monthAssets),
      debts: Math.round(monthDebts),
      netWorth: Math.round(monthAssets - monthDebts),
      isSnapshot: false,
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
      displayName: a.displayName,
      balance: safeNumber(a.balance),
      type: a.type || "Other",
      excludeFromSurplus: a.excludeFromSurplus,
      isDebt: a.isDebt,
      showInSidebar: a.showInSidebar,
      excludeFromAssetCalculation: a.excludeFromAssetCalculation,
      showTransactions: a.showTransactions
    }))
  };
}
