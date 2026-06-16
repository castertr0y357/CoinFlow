"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const AddManualTransactionSchema = z.object({
  date: z.string().refine(val => !isNaN(Date.parse(val))),
  payee: z.string().min(1),
  amount: z.number(),
  memo: z.string().optional(),
  categoryId: z.string().min(1),
});

export async function addManualTransaction(data: {
  date: string;
  payee: string;
  amount: number;
  memo?: string;
  categoryId: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = AddManualTransactionSchema.parse(data);
    
    // Find a default account for manual entries (e.g. "Manual Entries" or the first available)
    let account = await prisma.account.findFirst({
      where: { name: "Manual Entries" }
    });

    if (!account) {
      account = await prisma.account.findFirst();
    }

    if (!account) {
      throw new Error("No accounts found to assign transaction to.");
    }

    const transaction = await prisma.transaction.create({
      data: {
        date: new Date(parsed.date),
        payee: parsed.payee,
        amount: parsed.amount,
        memo: parsed.memo,
        accountId: account.id,
        posted: true,
        splits: {
          create: {
            amount: parsed.amount,
            categoryId: parsed.categoryId,
            memo: parsed.memo
          }
        }
      }
    });

    revalidatePath("/");
    revalidatePath(`/categories/${parsed.categoryId}`);
    
    return transaction;
  } catch (error) {
    console.error("[TRANSACTION ACTION ERROR] addManualTransaction failed:", error);
    throw error;
  }
}

