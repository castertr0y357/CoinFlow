"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Ensures a BudgetYear record exists for the given year.
 */
async function ensureBudgetYear(year: number) {
  let budgetYear = await prisma.budgetYear.findUnique({ where: { year } });
  if (!budgetYear) {
    budgetYear = await prisma.budgetYear.create({ data: { year } });
  }
  return budgetYear;
}

/**
 * Applies a single category's ending balance from sourceYear into (sourceYear + 1)'s rollover.
 */
export async function applySingleCategoryRollover(
  categoryId: string,
  sourceYear: number,
  amount: number
) {
  const targetYear = sourceYear + 1;
  const budgetYear = await ensureBudgetYear(targetYear);

  await prisma.yearlyCategory.upsert({
    where: {
      yearId_categoryId: {
        categoryId,
        yearId: budgetYear.id,
      },
    },
    update: {
      rollover: amount,
    },
    create: {
      categoryId,
      yearId: budgetYear.id,
      monthlyBudget: 0,
      rollover: amount,
      adjustment: 0,
    },
  });

  revalidatePath("/reports");
  revalidatePath("/");
  return { success: true, targetYear };
}

/**
 * Batch-applies all category ending balances from sourceYear into (sourceYear + 1)'s rollover.
 */
export async function finalizeYearEndRollovers(
  sourceYear: number,
  items: Array<{ categoryId: string; amount: number }>
) {
  const targetYear = sourceYear + 1;
  const budgetYear = await ensureBudgetYear(targetYear);

  await prisma.$transaction(
    items.map((item) =>
      prisma.yearlyCategory.upsert({
        where: {
          yearId_categoryId: {
            categoryId: item.categoryId,
            yearId: budgetYear.id,
          },
        },
        update: {
          rollover: item.amount,
        },
        create: {
          categoryId: item.categoryId,
          yearId: budgetYear.id,
          monthlyBudget: 0,
          rollover: item.amount,
          adjustment: 0,
        },
      })
    )
  );

  revalidatePath("/reports");
  revalidatePath("/");
  return { success: true, count: items.length, targetYear };
}
