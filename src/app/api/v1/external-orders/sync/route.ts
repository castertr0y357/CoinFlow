import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { processScrapedOrder, isOrderAlreadyMatched } from "@/lib/external-orders";
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
        matchedTransactions: 0,
        bufferedOrders: 0,
        skippedDuplicates: 0,
      };

      // 1. Filter out orders that are already matched (duplicate scan protection)
      const nonDuplicateOrders: SyncOrder[] = [];
      for (const order of orders) {
        if (await isOrderAlreadyMatched(order.orderId)) {
          logger.info("ExternalOrderSync", `Order ${order.orderId} already matched. Discarding duplicate scan.`);
          results.skippedDuplicates++;
        } else {
          nonDuplicateOrders.push(order);
        }
      }

      if (nonDuplicateOrders.length === 0) {
        return NextResponse.json(results);
      }

      // 2. Extract all unique titles across remaining orders for batch normalization
      const allTitles = new Set<string>();
      for (const order of nonDuplicateOrders) {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: SyncOrderItem) => {
            if (item.title) allTitles.add(item.title);
          });
        }
      }

      logger.info("ExternalOrderSync", `Normalizing ${allTitles.size} unique titles...`);
      const normalizedTitles = await normalizeItemNames(Array.from(allTitles));

      // 3. Process each order
      for (const order of nonDuplicateOrders) {
        const { orderId, date, totalAmount, items } = order;

        // Deduplicate incoming items as a safety measure
        const uniqueItems = items.filter((item: SyncOrderItem, index: number, self: SyncOrderItem[]) =>
          index === self.findIndex((t: SyncOrderItem) => (
            t.title.toLowerCase() === item.title.toLowerCase() && t.price === item.price
          ))
        );

        const normalizedItems = uniqueItems.map(item => ({
          title: normalizedTitles[item.title] || item.title,
          rawTitle: item.title,
          price: item.price,
          quantity: item.quantity || 1,
        }));

        const processResult = await processScrapedOrder({
          orderId,
          source: source.toUpperCase(),
          date,
          totalAmount,
          items: normalizedItems,
        });

        results.ordersProcessed++;

        if (processResult.duplicate) {
          results.skippedDuplicates++;
        } else if (processResult.matched) {
          results.matchedTransactions++;
        } else {
          results.bufferedOrders++;
          results.itemsCreated += normalizedItems.length;
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
