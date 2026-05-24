import { PrismaClient } from '@prisma/client';

function getPayeeFilterForSource(source: string) {
  const src = source.toUpperCase();
  if (src === 'AMAZON') {
    return {
      OR: [
        { payee: { contains: 'amazon', mode: 'insensitive' as const } },
        { payee: { contains: 'amzn', mode: 'insensitive' as const } }
      ]
    };
  }
  if (src === 'WALMART') {
    return {
      OR: [
        { payee: { contains: 'walmart', mode: 'insensitive' as const } },
        { payee: { contains: 'wal-mart', mode: 'insensitive' as const } },
        { payee: { contains: 'wm supercenter', mode: 'insensitive' as const } },
        { payee: { contains: 'wm.com', mode: 'insensitive' as const } },
        { payee: { startsWith: 'wm ', mode: 'insensitive' as const } }
      ]
    };
  }
  if (src === 'LOWES') {
    return {
      OR: [
        { payee: { contains: 'lowes', mode: 'insensitive' as const } },
        { payee: { contains: 'lowe\'s', mode: 'insensitive' as const } }
      ]
    };
  }
  return {};
}

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Re-matching for Unmatched External Orders...");

  const unmatchedOrders = await prisma.externalOrder.findMany({
    where: {
      transaction: null
    }
  });

  console.log(`Found ${unmatchedOrders.length} unmatched orders.`);

  let matchCount = 0;

  for (const order of unmatchedOrders) {
    const totalAmount = Number(order.totalAmount);
    const date = order.date;

    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - 3);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 10);
    endDate.setHours(23, 59, 59, 999);

    const payeeFilter = getPayeeFilterForSource(order.source);

    const foundTx = await prisma.transaction.findFirst({
      where: {
        amount: -totalAmount,
        date: {
          gte: startDate,
          lte: endDate
        },
        externalOrderId: null,
        ...payeeFilter
      },
      orderBy: { date: 'asc' }
    });

    if (foundTx) {
      console.log(`Matching Order ${order.orderId} ($${totalAmount}) to Transaction ${foundTx.id} (${foundTx.payee}) on ${foundTx.date.toISOString()}`);
      await prisma.transaction.update({
        where: { id: foundTx.id },
        data: { externalOrderId: order.id }
      });
      matchCount++;
    }
  }

  console.log(`Successfully matched ${matchCount} orders.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
