"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { applySplits, bulkCategorize, deleteSplit } from "@/lib/services/transactionService";

export async function categorizeSplit(splitId: string, categoryId: string | null) {
  await prisma.transactionSplit.update({
    where: { id: splitId },
    data: { categoryId },
  });
  
  revalidatePath("/transactions");
  revalidatePath("/");
}

export async function applyTransactionSplits(transactionId: string, splits: any[]) {
  await applySplits(transactionId, splits);
  revalidatePath("/transactions");
  revalidatePath("/");
}


export async function addSplit(transactionId: string, amount: number, categoryId: string | null) {
  // Find the original "floating" split (the one without a category)
  // Or just find a split that has enough amount to be split further
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
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
  
  if (uncategorizedSplit && Math.abs(Number(uncategorizedSplit.amount)) >= Math.abs(amount)) {
    const newUncatAmount = Number(uncategorizedSplit.amount) - amount; // Works for negative numbers too
    
    await prisma.$transaction([
      prisma.transactionSplit.update({
        where: { id: uncategorizedSplit.id },
        data: { amount: newUncatAmount }
      }),
      prisma.transactionSplit.create({
        data: {
          transactionId,
          categoryId,
          amount: amount
        }
      })
    ]);
  } else {
    // If no uncategorized split exists to pull from, just create it (though this means the total splits might not equal the tx amount, in a real app we'd validate this strictly)
    await prisma.transactionSplit.create({
      data: {
        transactionId,
        categoryId,
        amount: amount
      }
    });
  }

  revalidatePath("/transactions");
  revalidatePath("/");
}

export async function hideTransaction(transactionId: string, hide: boolean = true) {
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { isHidden: hide }
  });
  
  revalidatePath("/transactions");
  revalidatePath("/");
}

export async function bulkCategorizeTransactions(transactionIds: string[], categoryId: string | null) {
  await bulkCategorize(transactionIds, categoryId);
  revalidatePath("/transactions");
  revalidatePath("/");
}

export async function deleteTransactionSplit(splitId: string) {
  await deleteSplit(splitId);
  revalidatePath("/transactions");
  revalidatePath("/");
}

export async function updateSplitMemo(splitId: string, memo: string | null) {
  await prisma.transactionSplit.update({
    where: { id: splitId },
    data: { memo: memo || null },
  });
  revalidatePath("/transactions");
  revalidatePath("/");
}

export async function updateTransactionMemo(transactionId: string, memo: string | null) {
  await prisma.$transaction([
    prisma.transaction.update({
      where: { id: transactionId },
      data: { memo: memo || null }
    }),
    prisma.transactionSplit.updateMany({
      where: { transactionId },
      data: { memo: memo || null }
    })
  ]);
  revalidatePath("/transactions");
  revalidatePath("/");
}
import { linkRefund as linkRefundService } from "@/lib/services/transactionService";

export async function linkRefundAction(refundTransactionId: string, categoryId: string) {
  await linkRefundService(refundTransactionId, categoryId);
  revalidatePath("/transactions");
  revalidatePath("/");
  return { success: true };
}
