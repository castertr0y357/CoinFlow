"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export async function runMonthlyProvisioning(targetYear?: number) {
  const now = new Date();
  const yearNum = targetYear || now.getFullYear();
  const isCurrentYear = yearNum === now.getFullYear();
  const maxMonth = isCurrentYear ? now.getMonth() : 11; // 0-indexed month
  
  // 1. Ensure the BudgetYear exists
  let budgetYear = await prisma.budgetYear.findUnique({
    where: { year: yearNum }
  });

  if (!budgetYear) {
    budgetYear = await prisma.budgetYear.create({
      data: { year: yearNum }
    });
  }

  // 2. Get all categories and their yearly configs for this year
  const categories = await prisma.category.findMany({
    include: {
      configs: {
        where: { yearId: budgetYear.id }
      }
    }
  });

  const manualAccount = await prisma.account.findFirst({
    where: { name: "Manual Entries" }
  }) || await prisma.account.findFirst();

  if (!manualAccount) return;

  // 3. Fetch all existing "Month Start Provision" transactions for this year to optimize
  const startOfYear = new Date(yearNum, 0, 1);
  const endOfYear = new Date(yearNum, 11, 31, 23, 59, 59);
  
  const existingProvisions = await prisma.transaction.findMany({
    where: {
      date: { gte: startOfYear, lte: endOfYear },
      payee: { startsWith: "Month Start Provision" }
    },
    include: {
      splits: {
        select: { categoryId: true }
      }
    }
  });

  let provisionsCreated = 0;

  // 4. Iterate through each month (Jan to current/end)
  for (let m = 0; m <= maxMonth; m++) {
    const startOfMonth = new Date(yearNum, m, 1);
    
    for (const cat of categories) {
      const config = cat.configs[0];
      // Skip if no budget, paused, or if category didn't exist yet
      if (!config || Number(config.monthlyBudget) <= 0 || cat.isPaused) continue;
      
      // Check if a provision already exists for this month/category in our local list
      const alreadyExists = existingProvisions.some(p => {
        const pDate = new Date(p.date);
        return pDate.getMonth() === m && 
               pDate.getFullYear() === yearNum &&
               p.splits.some(s => s.categoryId === cat.id);
      });

      if (!alreadyExists) {
        const amount = Number(config.monthlyBudget);
        await prisma.transaction.create({
          data: {
            date: startOfMonth,
            payee: `Month Start Provision - ${cat.name}`,
            amount: amount,
            accountId: manualAccount.id,
            posted: true,
            splits: {
              create: {
                amount: amount,
                categoryId: cat.id,
                memo: `Automated monthly provision for ${cat.name}`
              }
            }
          }
        });
        provisionsCreated++;
      }
    }
  }

  if (provisionsCreated > 0) {
    logger.info("Provisioning", `Created ${provisionsCreated} missing budget allotments for ${yearNum}.`);
    try {
      revalidatePath("/");
      revalidatePath("/settings/general");
    } catch {
      // Ignore if not in Next environment
    }
  }
}
