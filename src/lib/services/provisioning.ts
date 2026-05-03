"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function runMonthlyProvisioning() {
  const now = new Date();
  const yearNum = now.getFullYear();
  const monthNum = now.getMonth(); // 0-indexed
  
  // Start of the current month
  const startOfMonth = new Date(yearNum, monthNum, 1);
  const endOfMonth = new Date(yearNum, monthNum + 1, 0);

  // 1. Ensure the BudgetYear exists
  let budgetYear = await prisma.budgetYear.findUnique({
    where: { year: yearNum }
  });

  if (!budgetYear) {
    budgetYear = await prisma.budgetYear.create({
      data: { year: yearNum }
    });
  }

  // 2. Get all categories and their yearly configs
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

  if (!manualAccount) return; // Need an account to associate transactions

  for (const cat of categories) {
    const config = cat.configs[0];
    if (!config || Number(config.monthlyBudget) <= 0 || cat.isPaused) continue;

    // 3. Check if a provision already exists for this month/category
    const existing = await prisma.transaction.findFirst({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        },
        payee: { startsWith: "Month Start Provision" },
        splits: {
          some: {
            categoryId: cat.id
          }
        }
      }
    });

    if (!existing) {
      // 4. Create the provision transaction
      const amount = Number(config.monthlyBudget);
      await prisma.transaction.create({
        data: {
          date: startOfMonth,
          payee: `Month Start Provision - ${cat.name}`,
          amount: amount, // Positive for income/provision
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
    }
  }

  revalidatePath("/");
}
