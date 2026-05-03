import Papa from 'papaparse';
import prisma from './prisma';

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
    const amazonOrder = await prisma.amazonOrder.upsert({
      where: { orderId },
      update: {
        date: data.date,
        totalAmount: data.total,
      },
      create: {
        orderId,
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
    // Amazon transactions often post a day or two later
    const startDate = new Date(data.date);
    const endDate = new Date(data.date);
    endDate.setDate(endDate.getDate() + 5); // Look up to 5 days after

    const transaction = await prisma.transaction.findFirst({
      where: {
        amount: -data.total, // Amazon orders are usually debits (negative)
        date: {
          gte: startDate,
          lte: endDate
        },
        amazonOrderId: null // Not already matched
      }
    });

    if (transaction) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { amazonOrderId: amazonOrder.id }
      });
      results.matchedTransactions++;
    }
  }

  return results;
}
