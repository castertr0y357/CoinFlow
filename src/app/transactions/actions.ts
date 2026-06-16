"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { applySplits, bulkCategorize, deleteSplit, linkRefund as linkRefundService } from "@/lib/services/transactionService";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const CategorizeSplitSchema = z.object({
  splitId: z.string().min(1),
  categoryId: z.string().nullable(),
});

const ApplySplitsSchema = z.object({
  transactionId: z.string().min(1),
  splits: z.array(z.object({
    categoryId: z.string().nullable(),
    amount: z.number(),
    memo: z.string().optional(),
  })),
});

const AddSplitSchema = z.object({
  transactionId: z.string().min(1),
  amount: z.number(),
  categoryId: z.string().nullable(),
});

const HideTransactionSchema = z.object({
  transactionId: z.string().min(1),
  hide: z.boolean(),
});

const BulkCategorizeSchema = z.object({
  transactionIds: z.array(z.string().min(1)),
  categoryId: z.string().nullable(),
});

const DeleteSplitSchema = z.object({
  splitId: z.string().min(1),
});

const UpdateSplitMemoSchema = z.object({
  splitId: z.string().min(1),
  memo: z.string().nullable(),
});

const UpdateTransactionMemoSchema = z.object({
  transactionId: z.string().min(1),
  memo: z.string().nullable(),
});

const LinkRefundSchema = z.object({
  refundTransactionId: z.string().min(1),
  categoryId: z.string().min(1),
});

export async function categorizeSplit(splitId: string, categoryId: string | null) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = CategorizeSplitSchema.parse({ splitId, categoryId });
    await prisma.transactionSplit.update({
      where: { id: parsed.splitId },
      data: { categoryId: parsed.categoryId },
    });
    
    revalidatePath("/transactions");
    revalidatePath("/");
  } catch (error) {
    console.error("[TRANSACTION ACTION ERROR] categorizeSplit failed:", error);
    throw error;
  }
}

export async function applyTransactionSplits(
  transactionId: string,
  splits: { categoryId: string | null; amount: number; memo?: string }[]
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = ApplySplitsSchema.parse({ transactionId, splits });
    await applySplits(parsed.transactionId, parsed.splits);
    revalidatePath("/transactions");
    revalidatePath("/");
  } catch (error) {
    console.error("[TRANSACTION ACTION ERROR] applyTransactionSplits failed:", error);
    throw error;
  }
}

export async function addSplit(transactionId: string, amount: number, categoryId: string | null) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = AddSplitSchema.parse({ transactionId, amount, categoryId });
    
    // Find the original "floating" split (the one without a category)
    // Or just find a split that has enough amount to be split further
    const tx = await prisma.transaction.findUnique({
      where: { id: parsed.transactionId },
      include: {
        splits: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!tx) throw new Error("Transaction not found");

    // Simple logic: just add a new split and reduce an existing uncategorized split
    const uncategorizedSplit = tx.splits.find(s => s.categoryId === null);
    
    if (uncategorizedSplit && Math.abs(Number(uncategorizedSplit.amount)) >= Math.abs(parsed.amount)) {
      const newUncatAmount = Number(uncategorizedSplit.amount) - parsed.amount; // Works for negative numbers too
      
      await prisma.$transaction([
        prisma.transactionSplit.update({
          where: { id: uncategorizedSplit.id },
          data: { amount: newUncatAmount }
        }),
        prisma.transactionSplit.create({
          data: {
            transactionId: parsed.transactionId,
            categoryId: parsed.categoryId,
            amount: parsed.amount
          }
        })
      ]);
    } else {
      // If no uncategorized split exists to pull from, just create it
      await prisma.transactionSplit.create({
        data: {
          transactionId: parsed.transactionId,
          categoryId: parsed.categoryId,
          amount: parsed.amount
        }
      });
    }

    revalidatePath("/transactions");
    revalidatePath("/");
  } catch (error) {
    console.error("[TRANSACTION ACTION ERROR] addSplit failed:", error);
    throw error;
  }
}

export async function hideTransaction(transactionId: string, hide: boolean = true) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = HideTransactionSchema.parse({ transactionId, hide });
    await prisma.transaction.update({
      where: { id: parsed.transactionId },
      data: { isHidden: parsed.hide }
    });
    
    revalidatePath("/transactions");
    revalidatePath("/");
  } catch (error) {
    console.error("[TRANSACTION ACTION ERROR] hideTransaction failed:", error);
    throw error;
  }
}

export async function bulkCategorizeTransactions(transactionIds: string[], categoryId: string | null) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = BulkCategorizeSchema.parse({ transactionIds, categoryId });
    await bulkCategorize(parsed.transactionIds, parsed.categoryId);
    revalidatePath("/transactions");
    revalidatePath("/");
  } catch (error) {
    console.error("[TRANSACTION ACTION ERROR] bulkCategorizeTransactions failed:", error);
    throw error;
  }
}

export async function deleteTransactionSplit(splitId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = DeleteSplitSchema.parse({ splitId });
    await deleteSplit(parsed.splitId);
    revalidatePath("/transactions");
    revalidatePath("/");
  } catch (error) {
    console.error("[TRANSACTION ACTION ERROR] deleteTransactionSplit failed:", error);
    throw error;
  }
}

export async function updateSplitMemo(splitId: string, memo: string | null) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = UpdateSplitMemoSchema.parse({ splitId, memo });
    await prisma.transactionSplit.update({
      where: { id: parsed.splitId },
      data: { memo: parsed.memo || null },
    });
    revalidatePath("/transactions");
    revalidatePath("/");
  } catch (error) {
    console.error("[TRANSACTION ACTION ERROR] updateSplitMemo failed:", error);
    throw error;
  }
}

export async function updateTransactionMemo(transactionId: string, memo: string | null) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = UpdateTransactionMemoSchema.parse({ transactionId, memo });
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: parsed.transactionId },
        data: { memo: parsed.memo || null }
      }),
      prisma.transactionSplit.updateMany({
        where: { transactionId: parsed.transactionId },
        data: { memo: parsed.memo || null }
      })
    ]);
    revalidatePath("/transactions");
    revalidatePath("/");
  } catch (error) {
    console.error("[TRANSACTION ACTION ERROR] updateTransactionMemo failed:", error);
    throw error;
  }
}

export async function linkRefundAction(refundTransactionId: string, categoryId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = LinkRefundSchema.parse({ refundTransactionId, categoryId });
    await linkRefundService(parsed.refundTransactionId, parsed.categoryId);
    revalidatePath("/transactions");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("[TRANSACTION ACTION ERROR] linkRefundAction failed:", error);
    throw error;
  }
}

