import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { processScrapedOrder, getAlreadyMatchedOrderIds } from "@/lib/external-orders";
import { cleanRetailItemTitleDeterministic } from "@/lib/normalizer";
import { logger } from "@/lib/logger";

interface SyncOrderItem {
  title: string;
  price: number;
  quantity?: number;
}

interface SyncOrderCharge {
  date: string;
  amount: number;
}

interface SyncOrder {
  orderId: string;
  date: string;
  totalAmount: number;
  items: SyncOrderItem[];
  charges?: SyncOrderCharge[];
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

      // 0. Expand split-shipment charges into individual matchable sub-orders
      const expandedOrders: SyncOrder[] = [];
      for (const order of orders) {
        if (order.charges && order.charges.length > 1) {
          order.charges.forEach((charge, idx) => {
            expandedOrders.push({
              ...order,
              orderId: `${order.orderId}#${idx + 1}`,
              date: charge.date,
              totalAmount: charge.amount,
            });
          });
        } else if (order.charges && order.charges.length === 1) {
          expandedOrders.push({
            ...order,
            date: order.charges[0].date,
            totalAmount: order.charges[0].amount,
          });
        } else {
          expandedOrders.push(order);
        }
      }

      // 1. Batch filter out orders that are already matched (duplicate scan protection)
      const incomingOrderIds = expandedOrders.map(o => o.orderId).filter(Boolean);
      const alreadyMatchedIds = await getAlreadyMatchedOrderIds(incomingOrderIds);

      const nonDuplicateOrders: SyncOrder[] = [];
      for (const order of expandedOrders) {
        if (alreadyMatchedIds.has(order.orderId)) {
          logger.info("ExternalOrderSync", `Order ${order.orderId} already matched. Discarding duplicate scan.`);
          results.skippedDuplicates++;
        } else {
          nonDuplicateOrders.push(order);
        }
      }

      if (nonDuplicateOrders.length === 0) {
        return NextResponse.json(results);
      }

      // 2. Process each order with instant deterministic item title cleaning
      for (const order of nonDuplicateOrders) {
        const { orderId, date, totalAmount, items } = order;

        // Deduplicate incoming items as a safety measure
        const uniqueItems = items.filter((item: SyncOrderItem, index: number, self: SyncOrderItem[]) =>
          index === self.findIndex((t: SyncOrderItem) => (
            t.title.toLowerCase() === item.title.toLowerCase() && t.price === item.price
          ))
        );

        const normalizedItems = uniqueItems.map(item => ({
          title: cleanRetailItemTitleDeterministic(item.title),
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
