import prisma from "../prisma";

export interface AmortizationRow {
  month: number;
  date: Date;
  interest: number;
  principal: number;
  balance: number;
  totalInterest: number;
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
  };
}

export function calculateAmortization(
  balance: number,
  annualRate: number,
  monthlyPayment: number,
  extraPrincipal: number = 0
): AmortizationRow[] {
  const schedule: AmortizationRow[] = [];
  const monthlyRate = annualRate / 100 / 12;
  let currentBalance = balance;
  let totalInterest = 0;
  let month = 1;
  const startDate = new Date();

  while (currentBalance > 0 && month <= 600) { // Max 50 years to prevent infinite loops
    const interest = currentBalance * monthlyRate;
    let principal = Math.min(currentBalance, (monthlyPayment - interest) + extraPrincipal);
    
    if (principal < 0) principal = 0; // Edge case for extremely low payments

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
}) {
  return prisma.mortgageDetail.upsert({
    where: { accountId: data.accountId },
    update: {
      interestRate: data.interestRate,
      monthlyPayment: data.monthlyPayment,
      startDate: data.startDate,
      termMonths: data.termMonths,
      homeValue: data.homeValue,
    },
    create: {
      accountId: data.accountId,
      interestRate: data.interestRate,
      monthlyPayment: data.monthlyPayment,
      startDate: data.startDate,
      termMonths: data.termMonths,
      homeValue: data.homeValue,
    },
  });
}
