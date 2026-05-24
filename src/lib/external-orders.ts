import Papa from 'papaparse';
import prisma from './prisma';
import { applySplits } from './services/transactionService';

export interface AmazonCsvRow {
  'Order ID': string;
  'Order Date': string;
  'Product Name': string;
  'Quantity': string;
  'Unit Price': string;
  'Total': string;
  [key: string]: any;
}

export async function processAmazonCsv(csvContent: string) {
  const parsed = Papa.parse<AmazonCsvRow>(csvContent, { header: true, skipEmptyLines: true });
  
  if (parsed.errors.length > 0) {
    throw new Error(`CSV Parsing error: ${parsed.errors[0].message}`);
  }

  const results = {
    ordersCreated: 0,
    itemsCreated: 0,
    matchedTransactions: 0
  };

  // Group items by Order ID
  const ordersMap = new Map<string, { date: Date, total: number, items: any[] }>();

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

  // Save to database and match with transactions
  for (const [orderId, data] of ordersMap.entries()) {
    const externalOrder = await prisma.externalOrder.upsert({
      where: { orderId },
      update: {
        date: data.date,
        totalAmount: data.total,
        source: 'AMAZON'
      },
      create: {
        orderId,
        source: 'AMAZON',
        date: data.date,
        totalAmount: data.total,
        items: {
          create: data.items
        }
      },
    });

    results.ordersCreated++;
    results.itemsCreated += data.items.length;

    // Matching logic: Look for transactions around the same date with the same amount
    // Broaden search window to handle timezone shifts and posting delays
    // Range: [OrderDate - 3 days, OrderDate + 10 days]
    const startDate = new Date(data.date);
    startDate.setDate(startDate.getDate() - 3);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(data.date);
    endDate.setDate(endDate.getDate() + 10);
    endDate.setHours(23, 59, 59, 999);

    const payeeFilter = getPayeeFilterForSource('AMAZON');

    const transaction = await prisma.transaction.findFirst({
      where: {
        amount: -data.total, 
        date: {
          gte: startDate,
          lte: endDate
        },
        externalOrderId: null,
        ...payeeFilter
      },
      orderBy: { date: 'asc' }
    });

    if (transaction) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { externalOrderId: externalOrder.id }
      });

      // Auto-split the transaction based on items
      const splits = calculateProportionalSplits(Number(transaction.amount), data.items);
      await applySplits(transaction.id, splits);

      results.matchedTransactions++;
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
