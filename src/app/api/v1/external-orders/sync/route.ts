import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { applySplits } from "@/lib/services/transactionService";
import { calculateProportionalSplits, getPayeeFilterForSource } from "@/lib/external-orders";
import { normalizeItemNames } from "@/lib/services/aiService";
import { logger } from "@/lib/logger";

interface SyncOrderItem {
  title: string;
  price: number;
  quantity?: number;
}

interface SyncOrder {
  orderId: string;
  date: string;
  totalAmount: number;
  items: SyncOrderItem[];
}

interface SyncPayload {
  source: string;
  orders: SyncOrder[];
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    let body: SyncPayload | undefined;
    try {
      body = await req.json() as SyncPayload;
      const { source, orders } = body;

      if (!source || !orders || !Array.isArray(orders)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      const results = {
        ordersProcessed: 0,
        itemsCreated: 0,
        matchedTransactions: 0
      };

      // Extract all unique titles across all orders for batch normalization
      const allTitles = new Set<string>();
      for (const order of orders) {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: SyncOrderItem) => {
            if (item.title) allTitles.add(item.title);
          });
        }
      }

      logger.info("ExternalOrderSync", `Normalizing ${allTitles.size} unique titles...`);
      const normalizedTitles = await normalizeItemNames(Array.from(allTitles));

      for (const order of orders) {
        const { orderId, date, totalAmount, items } = order;

        // Deduplicate incoming items as a safety measure
        const uniqueItems = items.filter((item: SyncOrderItem, index: number, self: SyncOrderItem[]) =>
          index === self.findIndex((t: SyncOrderItem) => (
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
          logger.info("ExternalOrderSync", `Skipping order ${orderId} - Already categorized.`);
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
              create: uniqueItems.map((item: SyncOrderItem) => ({
                title: normalizedTitles[item.title] || item.title,
                rawTitle: item.title,
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
              create: uniqueItems.map((item: SyncOrderItem) => ({
                title: normalizedTitles[item.title] || item.title,
                rawTitle: item.title,
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

        logger.info("ExternalOrderSync", `Searching for transaction: Amount -${totalAmount}, Range ${startDate.toISOString()} to ${endDate.toISOString()}`);

        const payeeFilter = getPayeeFilterForSource(source);

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
          orderBy: { date: 'asc' } // Pick the one closest to the order date if multiple exist
        });

        if (foundTx) {
          logger.info("ExternalOrderSync", `Matched transaction ${foundTx.id} (${foundTx.payee}) to order ${orderId}`);
          await prisma.transaction.update({
            where: { id: foundTx.id },
            data: { externalOrderId: externalOrder.id }
          });
          matchedTransactionId = foundTx.id;
          results.matchedTransactions++;
        } else {
          logger.warn("ExternalOrderSync", `No transaction match found for order ${orderId} ($${totalAmount}) in window.`);
        }

        // Auto-split or re-split the transaction based on fresh items
        if (matchedTransactionId) {
          const fullTx = await prisma.transaction.findUnique({
            where: { id: matchedTransactionId }
          });
          if (fullTx) {
            const itemsForSplits = uniqueItems.map(item => ({
              title: item.title,
              price: item.price,
              quantity: item.quantity ?? 1
            }));
            const splits = calculateProportionalSplits(Number(fullTx.amount), itemsForSplits);
            await applySplits(fullTx.id, splits);
          }
        }
      }

      return NextResponse.json(results);
    } catch (error) {
      logger.error("ExternalOrderSync", "External Sync Error", error);
      logger.error("ExternalOrderSync", `Payload: ${JSON.stringify(body, null, 2)}`);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
