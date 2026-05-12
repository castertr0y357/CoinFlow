import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transaction.findMany({
    orderBy: { date: 'desc' },
    take: 10,
    include: { externalOrder: { include: { items: true } } }
  });

  const externalOrders = await prisma.externalOrder.findMany({
    orderBy: { date: 'desc' },
    take: 10,
    include: { items: true, transaction: true }
  });

  console.log("Recent Transactions:");
  transactions.forEach(tx => {
    console.log(`${tx.date.toISOString()} | ${tx.amount} | ${tx.payee} | ExtOrder: ${tx.externalOrder?.orderId || 'None'} (${tx.externalOrder?.items?.length || 0} items)`);
  });

  console.log("\nRecent External Orders:");
  externalOrders.forEach(eo => {
    console.log(`${eo.date.toISOString()} | ${eo.totalAmount} | ${eo.source} | Order: ${eo.orderId} | Items: ${eo.items.length} | Tx: ${eo.transaction?.id || 'None'}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
