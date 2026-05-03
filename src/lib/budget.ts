import prisma from "./prisma";
import { startOfMonth, endOfMonth } from "date-fns";

export async function getMonthlyTally() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
  const savingsTarget = settings?.savingsTarget ? Number(settings.savingsTarget) : 650.00;

  // Get all transactions this month
  const transactions = await prisma.transaction.findMany({
    where: {
      date: {
        gte: monthStart,
        lte: monthEnd
      }
    },
    include: {
      splits: true
    }
  });

  // Calculate "Floating" amount:
  // Any transaction split that DOES NOT have a categoryId is considered floating.
  let floatingTotal = 0;
  for (const tx of transactions) {
    for (const split of tx.splits) {
      if (!split.categoryId) {
        // Debits (negative amounts) increase floating spending
        // Credits (positive amounts) like refunds reduce it
        floatingTotal += Number(split.amount);
      }
    }
  }

  // Since debits are negative, adding them to the target will reduce it.
  // Example: 650 + (-120) = 530
  const currentTally = savingsTarget + floatingTotal;

  return {
    savingsTarget,
    floatingSpending: Math.abs(floatingTotal),
    currentTally
  };
}
