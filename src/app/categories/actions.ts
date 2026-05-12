"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateCategoryBudget(categoryId: string, budget: number) {
  const currentYear = new Date().getFullYear();
  
  let budgetYear = await prisma.budgetYear.findUnique({
    where: { year: currentYear }
  });

  if (!budgetYear) {
    budgetYear = await prisma.budgetYear.create({ data: { year: currentYear } });
  }

  await prisma.yearlyCategory.upsert({
    where: { 
      yearId_categoryId: {
        yearId: budgetYear.id,
        categoryId
      }
    },
    update: { monthlyBudget: budget },
    create: {
      yearId: budgetYear.id,
      categoryId,
      monthlyBudget: budget
    }
  });
  
  revalidatePath("/");
  revalidatePath(`/categories/${categoryId}`);
}

export async function updateTransaction(id: string, data: { payee: string, amount: number, date: string, memo?: string }) {
  await prisma.transaction.update({
    where: { id },
    data: {
      payee: data.payee,
      amount: data.amount,
      date: new Date(data.date),
      memo: data.memo,
      splits: {
        updateMany: {
          where: { transactionId: id },
          data: {
            amount: data.amount,
            memo: data.memo
          }
        }
      }
    }
  });
  
  revalidatePath("/");
}

export async function deleteTransaction(id: string) {
  await prisma.transaction.delete({
    where: { id }
  });
  
  revalidatePath("/");
}

export async function updateCategoryName(id: string, name: string) {
  await prisma.category.update({
    where: { id },
    data: { name }
  });
  
  revalidatePath("/");
  revalidatePath("/settings");
  revalidatePath(`/categories/${id}`);
}

export async function reclassifyTransaction(transactionId: string, oldCategoryId: string | null, newCategoryId: string | null) {
  // If transaction has multiple splits, this is complex.
  // For simplicity, if it's a single split, we just update it.
  const splits = await prisma.transactionSplit.findMany({
    where: { transactionId }
  });

  if (splits.length === 1) {
    await prisma.transactionSplit.update({
      where: { id: splits[0].id },
      data: { categoryId: newCategoryId }
    });
  } else {
    // If it's a complex split, we might need a more granular UI.
    // For now, let's update all splits that were in the 'old' category to the 'new' one
    await prisma.transactionSplit.updateMany({
      where: { 
        transactionId,
        categoryId: oldCategoryId 
      },
      data: { categoryId: newCategoryId }
    });
  }

  revalidatePath("/transactions");
  revalidatePath("/");
  if (oldCategoryId) revalidatePath(`/categories/${oldCategoryId}`);
  if (newCategoryId) revalidatePath(`/categories/${newCategoryId}`);
}

export async function splitTransactionInCategory(transactionId: string, currentCategoryId: string, targetCategoryId: string, amountToMove: number) {
  // Find the split in the current category
  const split = await prisma.transactionSplit.findFirst({
    where: { 
      transactionId,
      categoryId: currentCategoryId
    }
  });

  if (!split) throw new Error("Split not found in this category");

  const currentAmount = Number(split.amount);
  const isNegative = currentAmount < 0;
  
  // We need to move 'amountToMove' from currentAmount to a new split.
  // Note: amounts are often negative for expenses.
  // If we move $40 from -$100, the new amounts should be -$60 and -$40.
  
  // If amountToMove is positive (as entered in UI), we adjust based on the sign of the expense.
  const adjustedMoveAmount = isNegative ? -Math.abs(amountToMove) : Math.abs(amountToMove);

  if (Math.abs(currentAmount) < Math.abs(adjustedMoveAmount)) {
    throw new Error("Cannot move more than the available amount");
  }

  await prisma.$transaction([
    prisma.transactionSplit.update({
      where: { id: split.id },
      data: { amount: currentAmount - adjustedMoveAmount }
    }),
    prisma.transactionSplit.create({
      data: {
        transactionId,
        categoryId: targetCategoryId === "" ? null : targetCategoryId,
        amount: adjustedMoveAmount,
        memo: split.memo
      }
    })
  ]);

  revalidatePath("/");
  revalidatePath(`/categories/${currentCategoryId}`);
  revalidatePath(`/categories/${targetCategoryId}`);
}

export async function createCategory(name: string) {
  if (!name.trim()) return;

  const category = await prisma.category.create({
    data: { name: name.trim() }
  });

  const currentYear = new Date().getFullYear();
  let budgetYear = await prisma.budgetYear.findUnique({
    where: { year: currentYear }
  });

  if (!budgetYear) {
    budgetYear = await prisma.budgetYear.create({ data: { year: currentYear } });
  }

  await prisma.yearlyCategory.create({
    data: {
      yearId: budgetYear.id,
      categoryId: category.id,
      monthlyBudget: 0,
      adjustment: 0,
      rollover: 0
    }
  });

  revalidatePath("/");
  revalidatePath("/settings");
}

export async function deleteCategory(id: string) {
  // Check if there are any transactions using this category
  const splitCount = await prisma.transactionSplit.count({
    where: { categoryId: id }
  });

  if (splitCount > 0) {
    throw new Error("Cannot delete category with existing transactions. Please reclassify them first.");
  }

  await prisma.category.delete({
    where: { id }
  });

  revalidatePath("/");
  revalidatePath("/settings");
}

export async function moveCategory(id: string, direction: 'up' | 'down') {
  const categories = await prisma.category.findMany({
    orderBy: [
      { displayOrder: 'asc' },
      { name: 'asc' }
    ]
  });

  const currentIndex = categories.findIndex(c => c.id === id);
  if (currentIndex === -1) return;

  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= categories.length) return;

  // Perform the swap and re-sequence EVERYTHING to be safe
  const newOrder = [...categories];
  const [moved] = newOrder.splice(currentIndex, 1);
  newOrder.splice(targetIndex, 0, moved);

  await prisma.$transaction(
    newOrder.map((cat, idx) => 
      prisma.category.update({
        where: { id: cat.id },
        data: { displayOrder: idx }
      })
    )
  );

  revalidatePath("/");
  revalidatePath("/settings");
}

export async function reorderCategories(orderedIds: string[]) {
  await prisma.$transaction(
    orderedIds.map((id, idx) => 
      prisma.category.update({
        where: { id },
        data: { displayOrder: idx }
      })
    )
  );

  revalidatePath("/");
  revalidatePath("/settings");
}

export async function updateAccountExclusion(accountId: string, exclude: boolean) {
  await prisma.account.update({
    where: { id: accountId },
    data: { excludeFromSurplus: exclude }
  });
  
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function updateCategoryTie(categoryId: string, accountId: string | null) {
  await prisma.category.update({
    where: { id: categoryId },
    data: { tiedAccountId: accountId }
  });
  
  revalidatePath("/");
  revalidatePath(`/categories/${categoryId}`);
  revalidatePath("/settings");
}

export async function toggleAccountDebt(accountId: string, isDebt: boolean) {
  await prisma.account.update({
    where: { id: accountId },
    data: { isDebt }
  });
  
  revalidatePath("/");
  revalidatePath("/settings");
}

export async function toggleCategoryPause(categoryId: string, isPaused: boolean) {
  await prisma.category.update({
    where: { id: categoryId },
    data: { isPaused }
  });
  
  revalidatePath("/");
  revalidatePath(`/categories/${categoryId}`);
}
