import prisma from "../prisma";
import { simulatePayoff as simPayoff, Debt } from "../debtUtils";

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
    excludeFromSurplus: acc.excludeFromSurplus,
  }));
}

export async function saveDebtDetail(accountId: string, interestRate: number, minimumPayment: number) {
  return prisma.debtDetail.upsert({
    where: { accountId },
    update: {
      interestRate,
      minimumPayment
    },
    create: {
      accountId,
      interestRate,
      minimumPayment
    }
  });
}
