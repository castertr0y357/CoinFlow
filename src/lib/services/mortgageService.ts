import prisma from "../prisma";

export interface AmortizationRow {
  month: number;
  date: Date;
  interest: number;
  principal: number;
  balance: number;
  totalInterest: number;
  extraPaid?: number;
}

export async function getMortgageData() {
  const mortgage = await prisma.mortgageDetail.findFirst({
    include: { account: true }
  });

  if (!mortgage) return null;

  return {
    ...mortgage,
    currentBalance: Math.abs(Number(mortgage.account.balance || 0)),
    interestRate: Number(mortgage.interestRate),
    monthlyPayment: Number(mortgage.monthlyPayment),
    homeValue: mortgage.homeValue ? Number(mortgage.homeValue) : null,
    originalBalance: mortgage.originalBalance ? Number(mortgage.originalBalance) : null,
  };
}

export function calculateAmortization(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  extraPrincipal: number = 0,
  annualExtra: number = 0,
  oneTimeExtras: { monthIndex: number; amount: number }[] = [],
  startDate: Date = new Date()
): AmortizationRow[] {
  const schedule: AmortizationRow[] = [];
  const monthlyRate = annualRate / 100 / 12;
  let currentBalance = balance;
  let totalInterest = 0;
  let month = 1;

  while (currentBalance > 0 && month <= 600) { // Max 50 years to prevent infinite loops
    const interest = currentBalance * monthlyRate;
    
    // Calculate extra payments for this month
    let extraPaidThisMonth = extraPrincipal;
    if (month % 12 === 0) {
      extraPaidThisMonth += annualExtra;
    }
    const matchingOneTimes = oneTimeExtras.filter(ote => ote.monthIndex === month);
    const oneTimePaidThisMonth = matchingOneTimes.reduce((sum, ote) => sum + ote.amount, 0);
    extraPaidThisMonth += oneTimePaidThisMonth;

    let principal = (monthlyPayment - interest) + extraPaidThisMonth;
    
    if (principal < 0) principal = 0; // Edge case for extremely low payments
    if (principal > currentBalance) {
      principal = currentBalance;
    }

    currentBalance -= principal;
    totalInterest += interest;

    const date = new Date(startDate);
    date.setMonth(startDate.getMonth() + month);

    schedule.push({
      month,
      date,
      interest,
      principal,
      balance: currentBalance,
      totalInterest,
      extraPaid: extraPaidThisMonth,
    });

    month++;
  }

  return schedule;
}

export async function saveMortgageDetail(data: {
  accountId: string;
  interestRate: number;
  monthlyPayment: number;
  startDate: Date;
  termMonths: number;
  homeValue?: number;
  originalBalance?: number;
}) {
  return prisma.mortgageDetail.upsert({
    where: { accountId: data.accountId },
    update: {
      interestRate: data.interestRate,
      monthlyPayment: data.monthlyPayment,
      startDate: data.startDate,
      termMonths: data.termMonths,
      homeValue: data.homeValue,
      originalBalance: data.originalBalance,
    },
    create: {
      accountId: data.accountId,
      interestRate: data.interestRate,
      monthlyPayment: data.monthlyPayment,
      startDate: data.startDate,
      termMonths: data.termMonths,
      homeValue: data.homeValue,
      originalBalance: data.originalBalance,
    },
  });
}
