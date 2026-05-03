"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addManualTransaction(data: {
  date: string;
  payee: string;
  amount: number;
  memo?: string;
  categoryId: string;
}) {
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
      date: new Date(data.date),
      payee: data.payee,
      amount: data.amount,
      memo: data.memo,
      accountId: account.id,
      posted: true,
      splits: {
        create: {
          amount: data.amount,
          categoryId: data.categoryId,
          memo: data.memo
        }
      }
    }
  });

  revalidatePath("/");
  revalidatePath(`/categories/${data.categoryId}`);
  
  return transaction;
}
