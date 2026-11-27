"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";

export interface YearEndCategoryPreview {
  categoryId: string;
  name: string;
  monthlyBudget: number;
  endingBalance: number;
}

export async function getYearEndRolloverPreview(): Promise<YearEndCategoryPreview[]> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const currentYear = new Date().getFullYear();
  const currentBudgetYear = await prisma.budgetYear.findUnique({
    where: { year: currentYear },
    include: { configs: true },
  });

  const categories = await prisma.category.findMany({
    where: { isArchived: false },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

  const yearStart = new Date(Date.UTC(currentYear, 0, 1));
  const yearEnd = new Date(Date.UTC(currentYear + 1, 0, 1));

  const splitSums = await prisma.transactionSplit.groupBy({
    by: ["categoryId"],
    where: {
      categoryId: { not: null },
      transaction: { date: { gte: yearStart, lt: yearEnd } },
    },
    _sum: { amount: true },
  });

  const sumMap = new Map<string, number>();
  for (const row of splitSums) {
    if (row.categoryId) sumMap.set(row.categoryId, Number(row._sum.amount || 0));
  }

  return categories.map((cat) => {
    const config = currentBudgetYear?.configs.find((c) => c.categoryId === cat.id);
    const startingRollover = Number(config?.rollover || 0);
    const adjustment = Number(config?.adjustment || 0);
    const netSplits = sumMap.get(cat.id) || 0;
    const endingBalance = Math.round((startingRollover + adjustment + netSplits) * 100) / 100;

    return {
      categoryId: cat.id,
      name: cat.name,
      monthlyBudget: Number(config?.monthlyBudget || 0),
      endingBalance,
    };
  });
}

export async function closeYearAndStartNext(carryOverCategoryIds?: string[]) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const nextYear = currentYear + 1;

    // 1. Check if next year already exists
    const existingNext = await prisma.budgetYear.findUnique({
      where: { year: nextYear }
    });

    if (existingNext) {
      throw new Error(`${nextYear} budget is already initialized.`);
    }

    // 2. Find current year config
    const currentBudgetYear = await prisma.budgetYear.findUnique({
      where: { year: currentYear },
      include: { configs: true }
    });

    if (!currentBudgetYear) {
      throw new Error(`Current year ${currentYear} is not initialized. Please refresh the dashboard first.`);
    }

    // 3. Create next year
    const nextBudgetYear = await prisma.budgetYear.create({
      data: { year: nextYear }
    });

    // 4. Calculate rollovers for each category
    const categories = await prisma.category.findMany();
    
    for (const cat of categories) {
      const config = currentBudgetYear.configs.find(c => c.categoryId === cat.id);
      let rollover = 0;
      let monthlyBudget = 0;

      if (config) {
        monthlyBudget = Number(config.monthlyBudget);
        
        // Calculate YTD spent for current year
        const ytdSpent = await prisma.transactionSplit.aggregate({
          where: {
            categoryId: cat.id,
            transaction: {
              date: {
                gte: new Date(currentYear, 0, 1),
                lte: new Date(currentYear, 11, 31)
              }
            }
          },
          _sum: { amount: true }
        });
        
        const netSplits = Number(ytdSpent._sum.amount || 0);
        const startingRollover = Number(config.rollover || 0);
        const adjustment = Number(config.adjustment || 0);
        const surplus = Math.round((startingRollover + adjustment + netSplits) * 100) / 100;
        if (carryOverCategoryIds) {
          rollover = carryOverCategoryIds.includes(cat.id) ? surplus : 0;
        } else {
          rollover = surplus > 0 ? surplus : 0;
        }
      }

      await prisma.yearlyCategory.create({
        data: {
          yearId: nextBudgetYear.id,
          categoryId: cat.id,
          monthlyBudget,
          rollover
        }
      });
    }

    revalidatePath("/settings");
    revalidatePath("/");
    
    return nextYear;
  } catch (error) {
    console.error("[SETTINGS ACTION ERROR] closeYearAndStartNext failed:", error);
    throw error;
  }
}

