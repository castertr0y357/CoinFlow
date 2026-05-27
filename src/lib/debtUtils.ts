export interface DebtPayoffSimRow {
  month: number;
  date: Date;
  balances: Record<string, number>; // accountId -> balance
  payments: Record<string, number>; // accountId -> payment
  interestPaid: number;             // Interest paid this month across all debts
  totalBalance: number;
  totalInterestPaid: number;
}

export interface DebtPayoffSummary {
  strategyName: string;
  payoffMonths: number;
  totalInterest: number;
  payoffDate: Date;
  schedule: DebtPayoffSimRow[];
}

export interface Debt {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
}

export function simulatePayoff(
  debts: Debt[],
  extraMonthly: number,
  strategy: 'avalanche' | 'snowball' | 'minimums',
  startDate: Date = new Date()
): DebtPayoffSummary {
  const schedule: DebtPayoffSimRow[] = [];
  
  // Clone initial balances
  const currentBalances = debts.reduce((acc, d) => {
    acc[d.id] = d.balance;
    return acc;
  }, {} as Record<string, number>);

  let totalInterestPaid = 0;
  let month = 0;

  // Track initial total balance
  const initialTotal = debts.reduce((sum, d) => sum + d.balance, 0);

  // Add initial row at month 0
  schedule.push({
    month: 0,
    date: new Date(startDate),
    balances: { ...currentBalances },
    payments: debts.reduce((acc, d) => { acc[d.id] = 0; return acc; }, {} as Record<string, number>),
    interestPaid: 0,
    totalBalance: initialTotal,
    totalInterestPaid: 0
  });

  // Sum of initial minimum payments as baseline budget
  const initialMinPaymentsSum = debts.reduce((sum, d) => sum + d.minimumPayment, 0);
  const totalMonthlyBudget = initialMinPaymentsSum + extraMonthly;

  while (month < 600) {
    // 1. Check if all balances are zero
    const activeDebts = debts.filter(d => currentBalances[d.id] > 0);
    if (activeDebts.length === 0) {
      break;
    }

    month++;
    const nextDate = new Date(startDate);
    // Use UTC date logic or simple months to avoid time zone issues
    nextDate.setMonth(startDate.getMonth() + month);

    const monthlyInterest: Record<string, number> = {};
    const paymentsThisMonth: Record<string, number> = {};
    let interestPaidThisMonth = 0;

    // 2. Accrue interest first
    activeDebts.forEach(d => {
      const rate = d.interestRate / 100 / 12;
      const interest = currentBalances[d.id] * rate;
      currentBalances[d.id] += interest;
      monthlyInterest[d.id] = interest;
      interestPaidThisMonth += interest;
    });

    totalInterestPaid += interestPaidThisMonth;

    // 3. Allocate payments
    // Keep track of how much budget we have left
    let availableBudget = totalMonthlyBudget;

    // A. First pay minimums on all active debts
    activeDebts.forEach(d => {
      const balance = currentBalances[d.id];
      // Minimum payment cannot exceed the current balance (with accrued interest)
      let minPayment = Math.min(d.minimumPayment, balance);
      paymentsThisMonth[d.id] = minPayment;
      currentBalances[d.id] -= minPayment;
      availableBudget -= minPayment;
    });

    // If we overspent the budget just on minimum payments, adjust availableBudget to 0
    if (availableBudget < 0) availableBudget = 0;

    // B. Allocate remaining budget to the target debt based on strategy
    if (availableBudget > 0 && strategy !== 'minimums') {
      // Sort active debts by strategy
      const sorted = [...activeDebts].filter(d => currentBalances[d.id] > 0);
      if (strategy === 'avalanche') {
        // Highest interest rate first
        sorted.sort((a, b) => b.interestRate - a.interestRate);
      } else if (strategy === 'snowball') {
        // Smallest balance first
        sorted.sort((a, b) => currentBalances[a.id] - currentBalances[b.id]);
      }

      for (const targetDebt of sorted) {
        if (availableBudget <= 0) break;
        const currentBalance = currentBalances[targetDebt.id];
        if (currentBalance <= 0) continue;

        const extraPayment = Math.min(availableBudget, currentBalance);
        paymentsThisMonth[targetDebt.id] = (paymentsThisMonth[targetDebt.id] || 0) + extraPayment;
        currentBalances[targetDebt.id] -= extraPayment;
        availableBudget -= extraPayment;
      }
    }

    const totalBalance = debts.reduce((sum, d) => sum + currentBalances[d.id], 0);

    schedule.push({
      month,
      date: nextDate,
      balances: { ...currentBalances },
      payments: { ...paymentsThisMonth },
      interestPaid: interestPaidThisMonth,
      totalBalance,
      totalInterestPaid
    });

    // Safeguard: if no balances were reduced at all and interest is larger than payments, break to avoid infinite loop
    if (totalBalance >= schedule[schedule.length - 2].totalBalance && interestPaidThisMonth >= totalMonthlyBudget) {
      // We are in a debt trap where interest exceeds payment capacity
      break;
    }
  }

  const lastRow = schedule[schedule.length - 1];
  const payoffMonths = lastRow.totalBalance === 0 ? lastRow.month : 600;

  return {
    strategyName: strategy === 'avalanche' ? 'Debt Avalanche' : strategy === 'snowball' ? 'Debt Snowball' : 'Minimum Payments Only',
    payoffMonths,
    totalInterest: totalInterestPaid,
    payoffDate: lastRow.date,
    schedule
  };
}
