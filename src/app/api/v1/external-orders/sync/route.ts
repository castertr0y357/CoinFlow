import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { applySplits } from "@/lib/services/transactionService";
import { calculateProportionalSplits } from "@/lib/external-orders";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    let body: any;
    try {
      body = await req.json();
      const { source, orders } = body;

      if (!source || !orders || !Array.isArray(orders)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      const results = {
        ordersProcessed: 0,
        itemsCreated: 0,
        matchedTransactions: 0
      };

      for (const order of orders) {
        const { orderId, date, totalAmount, items } = order;

        // Deduplicate incoming items as a safety measure
        const uniqueItems = items.filter((item: any, index: number, self: any[]) =>
          index === self.findIndex((t: any) => (
            t.title.toLowerCase() === item.title.toLowerCase() && t.price === item.price
          ))
        );

        // Check for existing order and its categorization status
        const existingOrder = await prisma.externalOrder.findUnique({
          where: { orderId },
          include: { 
            transaction: {
              include: { splits: true }
            }
          }
        });

        // We can refresh if it's new OR if the transaction exists but is completely uncategorized
        const isCategorized = existingOrder?.transaction?.splits.some(s => s.categoryId !== null);
        const canRefresh = !existingOrder || !isCategorized;

        if (!canRefresh) {
          console.log(`CoinFlow: Skipping order ${orderId} - Already categorized.`);
          continue;
        }

        // If we are refreshing an existing order, clean up old items first
        if (existingOrder) {
          await prisma.externalOrderItem.deleteMany({
            where: { externalOrderId: existingOrder.id }
          });
        }

        // Upsert the order
        const externalOrder = await prisma.externalOrder.upsert({
          where: { orderId },
          update: {
            date: new Date(date),
            totalAmount: totalAmount,
            source: source,
            items: {
              create: uniqueItems.map((item: any) => ({
                title: item.title,
                price: item.price,
                quantity: item.quantity || 1
              }))
            }
          },
          create: {
            orderId,
            source: source,
            date: new Date(date),
            totalAmount: totalAmount,
            items: {
              create: uniqueItems.map((item: any) => ({
                title: item.title,
                price: item.price,
                quantity: item.quantity || 1
              }))
            }
          },
        });

        results.ordersProcessed++;
        results.itemsCreated += uniqueItems.length;

        // Matching logic
        let matchedTransactionId: string | null = existingOrder?.transaction?.id || null;

          // Broaden search window to handle timezone shifts and posting delays
          // Range: [OrderDate - 3 days, OrderDate + 10 days]
          const startDate = new Date(date);
          startDate.setDate(startDate.getDate() - 3);
          startDate.setHours(0, 0, 0, 0);

          const endDate = new Date(date);
          endDate.setDate(endDate.getDate() + 10);
          endDate.setHours(23, 59, 59, 999);

          console.log(`CoinFlow [Sync]: Searching for transaction: Amount -${totalAmount}, Range ${startDate.toISOString()} to ${endDate.toISOString()}`);

          const foundTx = await prisma.transaction.findFirst({
            where: {
              amount: -totalAmount, 
              date: {
                gte: startDate,
                lte: endDate
              },
              externalOrderId: null 
            },
            orderBy: { date: 'asc' } // Pick the one closest to the order date if multiple exist
          });

          if (foundTx) {
            console.log(`CoinFlow [Sync]: Matched transaction ${foundTx.id} (${foundTx.payee}) to order ${orderId}`);
            await prisma.transaction.update({
              where: { id: foundTx.id },
              data: { externalOrderId: externalOrder.id }
            });
            matchedTransactionId = foundTx.id;
            results.matchedTransactions++;
          } else {
            console.warn(`CoinFlow [Sync]: No transaction match found for order ${orderId} ($${totalAmount}) in window.`);
          }

        // Auto-split or re-split the transaction based on fresh items
        if (matchedTransactionId) {
          const fullTx = await prisma.transaction.findUnique({
            where: { id: matchedTransactionId }
          });
          if (fullTx) {
            const splits = calculateProportionalSplits(Number(fullTx.amount), uniqueItems);
            await applySplits(fullTx.id, splits);
          }
        }
      }

      return NextResponse.json(results);
    } catch (error: any) {
      console.error("External Sync Error:", error);
      console.error("Payload:", JSON.stringify(body, null, 2));
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
