"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const UpdateCategoryBudgetSchema = z.object({
  categoryId: z.string().min(1),
  budget: z.number().min(0),
});

const UpdateTransactionSchema = z.object({
  id: z.string().min(1),
  data: z.object({
    payee: z.string().min(1),
    amount: z.number(),
    date: z.string().refine(val => !isNaN(Date.parse(val))),
    memo: z.string().optional(),
  }),
});

const DeleteTransactionSchema = z.object({
  id: z.string().min(1),
});

const UpdateCategoryNameSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const ReclassifyTransactionSchema = z.object({
  transactionId: z.string().min(1),
  oldCategoryId: z.string().nullable(),
  newCategoryId: z.string().nullable(),
});

const SplitTransactionInCategorySchema = z.object({
  transactionId: z.string().min(1),
  currentCategoryId: z.string().min(1),
  targetCategoryId: z.string().nullable().or(z.literal("")),
  amountToMove: z.number().positive(),
});

const CreateCategorySchema = z.object({
  name: z.string().min(1),
});

const DeleteCategorySchema = z.object({
  id: z.string().min(1),
});

const MoveCategorySchema = z.object({
  id: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

const ReorderCategoriesSchema = z.object({
  orderedIds: z.array(z.string().min(1)),
});

const UpdateAccountExclusionSchema = z.object({
  accountId: z.string().min(1),
  exclude: z.boolean(),
});

const UpdateCategoryTieSchema = z.object({
  categoryId: z.string().min(1),
  accountId: z.string().nullable(),
});

const ToggleAccountDebtSchema = z.object({
  accountId: z.string().min(1),
  isDebt: z.boolean(),
});

const ToggleCategoryPauseSchema = z.object({
  categoryId: z.string().min(1),
  isPaused: z.boolean(),
});

const UpdateAccountSettingsSchema = z.object({
  accountId: z.string().min(1),
  data: z.object({
    name: z.string().min(1).optional(),
    displayName: z.string().nullable().optional(),
    showInSidebar: z.boolean().optional(),
    excludeFromAssetCalculation: z.boolean().optional(),
    excludeFromSurplus: z.boolean().optional(),
    isDebt: z.boolean().optional(),
    showTransactions: z.boolean().optional(),
    balance: z.number().optional(),
  }),
});

const CreateManualAccountSchema = z.object({
  name: z.string().min(1),
  balance: z.number(),
  isDebt: z.boolean(),
  interestRate: z.number().min(0).max(100).optional(),
  minimumPayment: z.number().min(0).optional(),
  remainingPayments: z.number().int().min(0).optional(),
});

const DeleteAccountSchema = z.object({
  accountId: z.string().min(1),
});

export async function updateCategoryBudget(categoryId: string, budget: number) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = UpdateCategoryBudgetSchema.parse({ categoryId, budget });
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
          categoryId: parsed.categoryId
        }
      },
      update: { monthlyBudget: parsed.budget },
      create: {
        yearId: budgetYear.id,
        categoryId: parsed.categoryId,
        monthlyBudget: parsed.budget
      }
    });
    
    revalidatePath("/");
    revalidatePath(`/categories/${parsed.categoryId}`);
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] updateCategoryBudget failed:", error);
    throw error;
  }
}

export async function updateTransaction(id: string, data: { payee: string, amount: number, date: string, memo?: string }) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = UpdateTransactionSchema.parse({ id, data });
    await prisma.transaction.update({
      where: { id: parsed.id },
      data: {
        payee: parsed.data.payee,
        amount: parsed.data.amount,
        date: new Date(parsed.data.date),
        memo: parsed.data.memo,
        splits: {
          updateMany: {
            where: { transactionId: parsed.id },
            data: {
              amount: parsed.data.amount,
              memo: parsed.data.memo
            }
          }
        }
      }
    });
    
    revalidatePath("/");
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] updateTransaction failed:", error);
    throw error;
  }
}

export async function deleteTransaction(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = DeleteTransactionSchema.parse({ id });
    await prisma.transaction.delete({
      where: { id: parsed.id }
    });
    
    revalidatePath("/");
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] deleteTransaction failed:", error);
    throw error;
  }
}

export async function updateCategoryName(id: string, name: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = UpdateCategoryNameSchema.parse({ id, name });
    await prisma.category.update({
      where: { id: parsed.id },
      data: { name: parsed.name }
    });
    
    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath(`/categories/${parsed.id}`);
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] updateCategoryName failed:", error);
    throw error;
  }
}

export async function reclassifyTransaction(transactionId: string, oldCategoryId: string | null, newCategoryId: string | null) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = ReclassifyTransactionSchema.parse({ transactionId, oldCategoryId, newCategoryId });
    
    const splits = await prisma.transactionSplit.findMany({
      where: { transactionId: parsed.transactionId }
    });

    if (splits.length === 1) {
      await prisma.transactionSplit.update({
        where: { id: splits[0].id },
        data: { categoryId: parsed.newCategoryId }
      });
    } else {
      await prisma.transactionSplit.updateMany({
        where: { 
          transactionId: parsed.transactionId,
          categoryId: parsed.oldCategoryId 
        },
        data: { categoryId: parsed.newCategoryId }
      });
    }

    revalidatePath("/transactions");
    revalidatePath("/");
    if (parsed.oldCategoryId) revalidatePath(`/categories/${parsed.oldCategoryId}`);
    if (parsed.newCategoryId) revalidatePath(`/categories/${parsed.newCategoryId}`);
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] reclassifyTransaction failed:", error);
    throw error;
  }
}

export async function splitTransactionInCategory(transactionId: string, currentCategoryId: string, targetCategoryId: string, amountToMove: number) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = SplitTransactionInCategorySchema.parse({ transactionId, currentCategoryId, targetCategoryId, amountToMove });
    
    const split = await prisma.transactionSplit.findFirst({
      where: { 
        transactionId: parsed.transactionId,
        categoryId: parsed.currentCategoryId
      }
    });

    if (!split) throw new Error("Split not found in this category");

    const currentAmount = Number(split.amount);
    const isNegative = currentAmount < 0;
    
    const adjustedMoveAmount = isNegative ? -Math.abs(parsed.amountToMove) : Math.abs(parsed.amountToMove);

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
          transactionId: parsed.transactionId,
          categoryId: parsed.targetCategoryId === "" ? null : parsed.targetCategoryId,
          amount: adjustedMoveAmount,
          memo: split.memo
        }
      })
    ]);

    revalidatePath("/");
    revalidatePath(`/categories/${parsed.currentCategoryId}`);
    if (parsed.targetCategoryId) revalidatePath(`/categories/${parsed.targetCategoryId}`);
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] splitTransactionInCategory failed:", error);
    throw error;
  }
}

export async function createCategory(name: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = CreateCategorySchema.parse({ name });
    const trimmedName = parsed.name.trim();
    if (!trimmedName) return;

    const category = await prisma.category.create({
      data: { name: trimmedName }
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
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] createCategory failed:", error);
    throw error;
  }
}

export async function deleteCategory(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = DeleteCategorySchema.parse({ id });
    const splitCount = await prisma.transactionSplit.count({
      where: { categoryId: parsed.id }
    });

    if (splitCount > 0) {
      throw new Error("Cannot delete category with existing transactions. Please reclassify them first.");
    }

    await prisma.category.delete({
      where: { id: parsed.id }
    });

    revalidatePath("/");
    revalidatePath("/settings");
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] deleteCategory failed:", error);
    throw error;
  }
}

export async function moveCategory(id: string, direction: 'up' | 'down') {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = MoveCategorySchema.parse({ id, direction });
    const categories = await prisma.category.findMany({
      orderBy: [
        { displayOrder: 'asc' },
        { name: 'asc' }
      ]
    });

    const currentIndex = categories.findIndex(c => c.id === parsed.id);
    if (currentIndex === -1) return;

    const targetIndex = parsed.direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= categories.length) return;

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
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] moveCategory failed:", error);
    throw error;
  }
}

export async function reorderCategories(orderedIds: string[]) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = ReorderCategoriesSchema.parse({ orderedIds });
    await prisma.$transaction(
      parsed.orderedIds.map((id, idx) => 
        prisma.category.update({
          where: { id },
          data: { displayOrder: idx }
        })
      )
    );

    revalidatePath("/");
    revalidatePath("/settings");
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] reorderCategories failed:", error);
    throw error;
  }
}

export async function updateAccountExclusion(accountId: string, exclude: boolean) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = UpdateAccountExclusionSchema.parse({ accountId, exclude });
    const updateData: { excludeFromSurplus: boolean; showInSidebar?: boolean } = { excludeFromSurplus: parsed.exclude };
    if (!parsed.exclude) {
      updateData.showInSidebar = true;
    }

    await prisma.account.update({
      where: { id: parsed.accountId },
      data: updateData
    });
    
    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath("/net-worth");
    revalidatePath("/accounts");
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] updateAccountExclusion failed:", error);
    throw error;
  }
}

export async function updateCategoryTie(categoryId: string, accountId: string | null) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = UpdateCategoryTieSchema.parse({ categoryId, accountId });
    await prisma.category.update({
      where: { id: parsed.categoryId },
      data: { tiedAccountId: parsed.accountId }
    });
    
    revalidatePath("/");
    revalidatePath(`/categories/${parsed.categoryId}`);
    revalidatePath("/settings");
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] updateCategoryTie failed:", error);
    throw error;
  }
}

export async function toggleAccountDebt(accountId: string, isDebt: boolean) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = ToggleAccountDebtSchema.parse({ accountId, isDebt });
    await prisma.account.update({
      where: { id: parsed.accountId },
      data: { isDebt: parsed.isDebt }
    });
    
    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath("/net-worth");
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] toggleAccountDebt failed:", error);
    throw error;
  }
}

export async function toggleCategoryPause(categoryId: string, isPaused: boolean) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = ToggleCategoryPauseSchema.parse({ categoryId, isPaused });
    await prisma.category.update({
      where: { id: parsed.categoryId },
      data: { isPaused: parsed.isPaused }
    });
    
    revalidatePath("/");
    revalidatePath(`/categories/${parsed.categoryId}`);
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] toggleCategoryPause failed:", error);
    throw error;
  }
}

export async function updateAccountSettings(
  accountId: string,
  data: {
    name?: string;
    displayName?: string | null;
    showInSidebar?: boolean;
    excludeFromAssetCalculation?: boolean;
    excludeFromSurplus?: boolean;
    isDebt?: boolean;
    showTransactions?: boolean;
    balance?: number;
  }
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = UpdateAccountSettingsSchema.parse({ accountId, data });
    const updateData = { ...parsed.data };

    if (updateData.showInSidebar === false) {
      updateData.excludeFromSurplus = true;
    } else if (updateData.excludeFromSurplus === false) {
      updateData.showInSidebar = true;
    }

    if (typeof updateData.balance === "number") {
      const account = await prisma.account.findUnique({
        where: { id: parsed.accountId },
        select: { isDebt: true }
      });
      const isDebt = updateData.isDebt !== undefined ? updateData.isDebt : (account?.isDebt ?? false);
      updateData.balance = isDebt ? -Math.abs(updateData.balance) : Math.abs(updateData.balance);
    }

    await prisma.account.update({
      where: { id: parsed.accountId },
      data: updateData
    });
    
    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath("/net-worth");
    revalidatePath("/accounts");
    revalidatePath("/transactions");
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] updateAccountSettings failed:", error);
    throw error;
  }
}

export async function createManualAccountAction(data: {
  name: string;
  balance: number;
  isDebt: boolean;
  interestRate?: number;
  minimumPayment?: number;
  remainingPayments?: number;
}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = CreateManualAccountSchema.parse(data);
    const remoteId = `manual-${randomUUID()}`;
    const finalBalance = parsed.isDebt ? -Math.abs(parsed.balance) : Math.abs(parsed.balance);
    
    const account = await prisma.account.create({
      data: {
        remoteId,
        name: parsed.name.trim(),
        displayName: parsed.name.trim(),
        balance: finalBalance,
        isDebt: parsed.isDebt,
        excludeFromSurplus: parsed.isDebt,
        type: parsed.isDebt ? "Loan" : "Cash",
        showTransactions: false,
      }
    });

    if (parsed.isDebt && (parsed.interestRate !== undefined || parsed.minimumPayment !== undefined || parsed.remainingPayments !== undefined)) {
      await prisma.debtDetail.create({
        data: {
          accountId: account.id,
          interestRate: parsed.interestRate ?? 0,
          minimumPayment: parsed.minimumPayment ?? 0,
          remainingPayments: parsed.remainingPayments ?? null
        }
      });
    }

    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath("/net-worth");
    revalidatePath("/accounts");
    revalidatePath("/transactions");
    revalidatePath("/debts");
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] createManualAccountAction failed:", error);
    throw error;
  }
}

export async function deleteAccountAction(accountId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = DeleteAccountSchema.parse({ accountId });
    const txIds = (await prisma.transaction.findMany({
      where: { accountId: parsed.accountId },
      select: { id: true }
    })).map(t => t.id);

    await prisma.$transaction([
      prisma.debtDetail.deleteMany({ where: { accountId: parsed.accountId } }),
      prisma.mortgageDetail.deleteMany({ where: { accountId: parsed.accountId } }),
      prisma.transactionSplit.deleteMany({ where: { transactionId: { in: txIds } } }),
      prisma.transaction.deleteMany({ where: { accountId: parsed.accountId } }),
      prisma.account.delete({ where: { id: parsed.accountId } })
    ]);

    revalidatePath("/");
    revalidatePath("/settings");
    revalidatePath("/net-worth");
    revalidatePath("/accounts");
    revalidatePath("/transactions");
    revalidatePath("/debts");
  } catch (error) {
    console.error("[CATEGORY ACTION ERROR] deleteAccountAction failed:", error);
    throw error;
  }
}
