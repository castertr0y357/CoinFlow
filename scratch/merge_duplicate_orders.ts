import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Starting Merge of Duplicate External Orders...");

  const allOrders = await prisma.externalOrder.findMany({
    include: { items: true, transaction: true }
  });

  const ordersByCleanId = new Map<string, any[]>();

  for (const order of allOrders) {
    const cleanId = order.orderId.replace(/ORDER #\s*/gi, '').trim();
    if (!ordersByCleanId.has(cleanId)) {
      ordersByCleanId.set(cleanId, []);
    }
    ordersByCleanId.get(cleanId)?.push(order);
  }

  let mergeCount = 0;

  for (const [cleanId, duplicates] of ordersByCleanId.entries()) {
    if (duplicates.length > 1) {
      console.log(`\nFound ${duplicates.length} records for Order ID: ${cleanId}`);
      
      // Find the one with items and the one with transaction
      const orderWithItems = duplicates.find(d => d.items.length > 0) || duplicates[0];
      const orderWithTx = duplicates.find(d => d.transaction !== null);

      if (orderWithTx && orderWithTx.id !== orderWithItems.id) {
        console.log(`- Moving transaction link from ${orderWithTx.orderId} to ${orderWithItems.orderId}`);
        
        await prisma.transaction.update({
          where: { id: orderWithTx.transaction.id },
          data: { externalOrderId: orderWithItems.id }
        });
      }

      // Ensure the surviving order has the clean ID
      if (orderWithItems.orderId !== cleanId) {
        await prisma.externalOrder.update({
          where: { id: orderWithItems.id },
          data: { orderId: cleanId }
        });
      }

      // Delete the other duplicates
      for (const d of duplicates) {
        if (d.id !== orderWithItems.id) {
          console.log(`- Deleting duplicate record: ${d.orderId}`);
          // Items will be deleted via cascade if any existed
          await prisma.externalOrder.delete({ where: { id: d.id } });
        }
      }
      mergeCount++;
    } else if (duplicates[0].orderId.includes("ORDER #")) {
        // Just clean up the ID if it's the only one
        console.log(`\nCleaning ID for single record: ${duplicates[0].orderId} -> ${cleanId}`);
        await prisma.externalOrder.update({
            where: { id: duplicates[0].id },
            data: { orderId: cleanId }
        });
    }
  }

  console.log(`\nSuccessfully merged/cleaned ${mergeCount} duplicate order groups.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
