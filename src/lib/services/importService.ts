import * as XLSX from 'xlsx';
import prisma from "@/lib/prisma";
import { suggestHistoricalMapping } from "./aiService";
import { Category } from "@/types";

export async function analyzeXlsx(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetInfo = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    const headers = data[0] || [];
    const samples = data.slice(1, 4); // Take 3 sample rows
    
    // Map samples back to header keys for the LLM
    const mappedSamples = samples.map(row => {
      const obj: any = {};
      headers.forEach((h: string, i: number) => {
        obj[h] = row[i];
      });
      return obj;
    });

    return { name, headers, samples: mappedSamples };
  });

  const categories = await prisma.category.findMany();
  const suggestions = await suggestHistoricalMapping(sheetInfo, categories as any);

  return {
    sheetInfo,
    suggestions: suggestions.mappings
  };
}

export async function executeHistoricalImport(
  buffer: Buffer, 
  year: number, 
  mappings: any[]
) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  // 1. Ensure the Year exists
  let budgetYear = await prisma.budgetYear.findUnique({ where: { year } });
  if (!budgetYear) {
    budgetYear = await prisma.budgetYear.create({ data: { year } });
  }

  const results = {
    transactionsCreated: 0,
    categoriesCreated: 0,
    errors: [] as string[]
  };

  // 2. Process each mapped sheet
  for (const mapping of mappings) {
    if (!mapping.isTransactionSheet) continue;

    const sheet = workbook.Sheets[mapping.sheetName];
    const data = XLSX.utils.sheet_to_json(sheet) as any[];

    // Find or create the category
    let category = await prisma.category.findUnique({
      where: { name: mapping.suggestedCategory }
    });

    if (!category) {
      category = await prisma.category.create({
        data: { name: mapping.suggestedCategory }
      });
      results.categoriesCreated++;
    }

    // Ensure YearlyCategory exists for this year
    await prisma.yearlyCategory.upsert({
      where: { 
        yearId_categoryId: {
          yearId: budgetYear.id,
          categoryId: category.id
        }
      },
      update: {}, // Don't overwrite if it exists
      create: {
        yearId: budgetYear.id,
        categoryId: category.id,
        monthlyBudget: 0
      }
    });

    // 3. Import transactions
    // Note: We'll put them in a default "Historical Import" account if not specified,
    // but the schema requires an accountId.
    const defaultAccount = await prisma.account.findFirst({
      where: { name: "Historical Import Archive" }
    }) || await prisma.account.create({
      data: {
        name: "Historical Import Archive",
        remoteId: `hist-${year}`,
        excludeFromSurplus: true // Don't mess up current surplus
      }
    });

    for (const row of data) {
      const date = new Date(row[mapping.dateColumn]);
      const payee = row[mapping.payeeColumn];
      const amount = Number(row[mapping.amountColumn]);

      if (isNaN(date.getTime()) || !payee || isNaN(amount)) {
        continue;
      }

      await prisma.transaction.create({
        data: {
          date,
          payee,
          amount,
          accountId: defaultAccount.id,
          splits: {
            create: {
              categoryId: category.id,
              amount: amount
            }
          }
        }
      });
      results.transactionsCreated++;
    }
  }

  return results;
}
