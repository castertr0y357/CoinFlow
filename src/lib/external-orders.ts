import Papa from 'papaparse';
import prisma from './prisma';
import { applySplits } from './services/transactionService';
import { logger } from './logger';

export interface AmazonCsvRow {
  'Order ID': string;
  'Order Date': string;
  'Product Name': string;
  'Quantity': string;
  'Unit Price': string;
  'Total': string;
  [key: string]: unknown;
}

export interface ExternalOrderItemPayload {
  title: string;
  rawTitle?: string;
  price: number;
  quantity: number;
}

export interface ProcessOrderPayload {
  orderId: string;
  source: string;
  date: Date | string;
  totalAmount: number;
  items: ExternalOrderItemPayload[];
}

export function detectSourceFromPayee(payee: string): string | null {
  const p = payee.toLowerCase();
  if (p.includes('amazon') || p.includes('amzn')) return 'AMAZON';
  if (
    p.includes('walmart') ||
    p.includes('wal-mart') ||
    p.includes('wm supercenter') ||
    p.includes('wm.com') ||
    p.startsWith('wm ')
  ) {
    return 'WALMART';
  }
  if (p.includes('lowes') || p.includes("lowe's")) return 'LOWES';
  return null;
}

export async function getAlreadyMatchedOrderIds(orderIds: string[]): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set();

  const existing = await prisma.transaction.findMany({
    where: {
      OR: [
        { matchedOrderId: { in: orderIds } },
        { externalOrder: { orderId: { in: orderIds } } }
      ]
    },
    select: {
      matchedOrderId: true,
      externalOrder: { select: { orderId: true } }
    }
  });

  const matched = new Set<string>();
  for (const tx of existing) {
    if (tx.matchedOrderId) matched.add(tx.matchedOrderId);
    if (tx.externalOrder?.orderId) matched.add(tx.externalOrder.orderId);
  }
  return matched;
}

export async function isOrderAlreadyMatched(orderId: string): Promise<boolean> {
  const existing = await prisma.transaction.findFirst({
    where: {
      OR: [
        { matchedOrderId: orderId },
        { externalOrder: { orderId } }
      ]
    },
    select: { id: true }
  });
  return !!existing;
}

export async function processScrapedOrder(order: ProcessOrderPayload): Promise<{
  matched: boolean;
  duplicate: boolean;
  transactionId?: string;
}> {
  const { orderId, source, date, totalAmount, items } = order;
  const parsedDate = new Date(date);

  // 1. Check if this order was already matched to a transaction (duplicate scan discard)
  if (await isOrderAlreadyMatched(orderId)) {
    logger.info("ExternalOrders", `Order ${orderId} already matched to a transaction. Discarding duplicate scan.`);
    return { matched: true, duplicate: true };
  }

  // 2. Search for existing unmatched bank transaction within [orderDate - 3 days, orderDate + 10 days]
  const startDate = new Date(parsedDate);
  startDate.setDate(startDate.getDate() - 3);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(parsedDate);
  endDate.setDate(endDate.getDate() + 21);
  endDate.setHours(23, 59, 59, 999);

  const payeeFilter = getPayeeFilterForSource(source);

  const matchingTx = await prisma.transaction.findFirst({
    where: {
      amount: -totalAmount,
      date: {
        gte: startDate,
        lte: endDate,
      },
      externalOrderId: null,
      matchedOrderId: null,
      ...payeeFilter,
    },
    include: {
      splits: true,
    },
    orderBy: { date: 'asc' },
  });

  if (matchingTx) {
    logger.info("ExternalOrders", `Matched order ${orderId} ($${totalAmount}) to existing transaction ${matchingTx.id} (${matchingTx.payee})`);

    // Calculate splits from items
    const splits = calculateProportionalSplits(Number(matchingTx.amount), items);
    await applySplits(matchingTx.id, splits);

    // Stamp matchedOrderId and matchedOrderSource
    await prisma.transaction.update({
      where: { id: matchingTx.id },
      data: {
        matchedOrderId: orderId,
        matchedOrderSource: source.toUpperCase(),
        externalOrderId: null,
      },
    });

    // Delete any existing buffered ExternalOrder record so matched orders are removed to save space
    await prisma.externalOrder.deleteMany({
      where: { orderId },
    });

    return { matched: true, duplicate: false, transactionId: matchingTx.id };
  }

  // 3. No match found yet: Buffer order in ExternalOrder table waiting for future bank transaction
  logger.info("ExternalOrders", `No matching transaction found for order ${orderId} ($${totalAmount}). Buffering in database.`);
  await prisma.externalOrder.upsert({
    where: { orderId },
    update: {
      date: parsedDate,
      totalAmount,
      source: source.toUpperCase(),
      items: {
        deleteMany: {},
        create: items.map(item => ({
          title: item.title,
          rawTitle: item.rawTitle || item.title,
          price: item.price,
          quantity: item.quantity || 1,
        })),
      },
    },
    create: {
      orderId,
      source: source.toUpperCase(),
      date: parsedDate,
      totalAmount,
      items: {
        create: items.map(item => ({
          title: item.title,
          rawTitle: item.rawTitle || item.title,
          price: item.price,
          quantity: item.quantity || 1,
        })),
      },
    },
  });

  return { matched: false, duplicate: false };
}

export async function matchTransactionToPendingOrder(transactionId: string): Promise<boolean> {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      splits: true,
      externalOrder: true,
    },
  });

  if (!tx) return false;
  if (tx.matchedOrderId || tx.externalOrderId) return false; // Already matched
  if (Number(tx.amount) >= 0) return false; // Inflows are not orders

  const source = detectSourceFromPayee(tx.payee) || (tx.rawPayee ? detectSourceFromPayee(tx.rawPayee) : null);
  if (!source) return false;

  const targetAmount = Math.abs(Number(tx.amount));

  // Range: [TransactionDate - 10 days, TransactionDate + 3 days]
  const startDate = new Date(tx.date);
  startDate.setDate(startDate.getDate() - 21);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(tx.date);
  endDate.setDate(endDate.getDate() + 3);
  endDate.setHours(23, 59, 59, 999);

  const pendingOrder = await prisma.externalOrder.findFirst({
    where: {
      source,
      totalAmount: targetAmount,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      items: true,
    },
    orderBy: { date: 'asc' },
  });

  if (!pendingOrder) {
    return false;
  }

  logger.info("ExternalOrders", `Matched new transaction ${tx.id} (${tx.payee}, $${tx.amount}) to pending order ${pendingOrder.orderId}`);

  // Split transaction using pending order items
  const itemsForSplits = pendingOrder.items.map(item => ({
    title: item.title,
    price: Number(item.price),
    quantity: item.quantity || 1,
  }));
  const splits = calculateProportionalSplits(Number(tx.amount), itemsForSplits);
  await applySplits(tx.id, splits);

  // Update transaction with matchedOrderId and matchedOrderSource
  await prisma.transaction.update({
    where: { id: tx.id },
    data: {
      matchedOrderId: pendingOrder.orderId,
      matchedOrderSource: pendingOrder.source,
      externalOrderId: null,
    },
  });

  // Remove matched order from DB to save space
  await prisma.externalOrder.delete({
    where: { id: pendingOrder.id },
  });

  logger.info("ExternalOrders", `Cleaned up matched order ${pendingOrder.orderId} from database.`);
  return true;
}

export async function processAmazonCsv(csvContent: string) {
  const parsed = Papa.parse<AmazonCsvRow>(csvContent, { header: true, skipEmptyLines: true });
  
  if (parsed.errors.length > 0) {
    throw new Error(`CSV Parsing error: ${parsed.errors[0].message}`);
  }

  const results = {
    ordersCreated: 0,
    itemsCreated: 0,
    matchedTransactions: 0,
    skippedDuplicates: 0,
  };

  // Group items by Order ID
  const ordersMap = new Map<string, { date: Date, total: number, items: ExternalOrderItemPayload[] }>();

  for (const row of parsed.data) {
    const orderId = row['Order ID'];
    if (!orderId) continue;

    if (!ordersMap.has(orderId)) {
      ordersMap.set(orderId, {
        date: new Date(row['Order Date']),
        total: parseFloat(row['Total'] || '0'),
        items: []
      });
    }

    ordersMap.get(orderId)?.items.push({
      title: row['Product Name'],
      price: parseFloat(row['Unit Price'] || '0'),
      quantity: parseInt(row['Quantity'] || '1')
    });
  }

  for (const [orderId, data] of ordersMap.entries()) {
    const processResult = await processScrapedOrder({
      orderId,
      source: 'AMAZON',
      date: data.date,
      totalAmount: data.total,
      items: data.items,
    });

    if (processResult.duplicate) {
      results.skippedDuplicates++;
    } else if (processResult.matched) {
      results.matchedTransactions++;
    } else {
      results.ordersCreated++;
      results.itemsCreated += data.items.length;
    }
  }

  return results;
}

export function getPayeeFilterForSource(source: string) {
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

export function calculateProportionalSplits(totalAmount: number, items: { title: string, price: number, quantity: number }[]) {
  const absTotal = Math.abs(totalAmount);
  const itemsSum = items.reduce((acc, item) => acc + (Number(item.price) * item.quantity), 0);
  
  if (items.length === 0 || itemsSum <= 0) {
    const itemCount = items.length || 1;
    const perItem = absTotal / itemCount;
    
    if (items.length === 0) {
      return [{
        categoryId: null,
        amount: totalAmount,
        memo: "External Order (No items found)"
      }];
    }

    return items.map(item => ({
      categoryId: null,
      amount: totalAmount < 0 ? -perItem : perItem,
      memo: item.title
    }));
  }

  const ratio = absTotal / itemsSum;
  let currentSum = 0;
  
  const splits = items.map((item, index) => {
    let amount: number;
    if (index === items.length - 1) {
      amount = Math.round((absTotal - currentSum) * 100) / 100;
    } else {
      amount = Math.round((Number(item.price) * item.quantity * ratio) * 100) / 100;
      currentSum += amount;
    }
    
    return {
      categoryId: null,
      amount: totalAmount < 0 ? -amount : amount,
      memo: item.title
    };
  });

  return splits;
}
