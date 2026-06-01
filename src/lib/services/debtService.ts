import prisma from "../prisma";

export async function getDebtAccounts() {
  const accounts = await prisma.account.findMany({
    where: {
      isDebt: true
    },
    include: {
      debtDetail: true
    },
    orderBy: { name: 'asc' }
  });

  return accounts.map(acc => ({
    id: acc.id,
    name: acc.displayName || acc.name,
    balance: Math.abs(Number(acc.balance || 0)),
    interestRate: acc.debtDetail ? Number(acc.debtDetail.interestRate) : 0,
    minimumPayment: acc.debtDetail ? Number(acc.debtDetail.minimumPayment) : 0,
    remainingPayments: acc.debtDetail ? acc.debtDetail.remainingPayments : null,
    excludeFromSurplus: acc.excludeFromSurplus,
  }));
}

export async function saveDebtDetail(
  accountId: string,
  interestRate: number,
  minimumPayment: number,
  remainingPayments?: number | null
) {
  return prisma.debtDetail.upsert({
    where: { accountId },
    update: {
      interestRate,
      minimumPayment,
      remainingPayments
    },
    create: {
      accountId,
      interestRate,
      minimumPayment,
      remainingPayments
    }
  });
}
