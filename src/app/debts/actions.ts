"use server";

import { saveDebtDetail } from "@/lib/services/debtService";
import { revalidatePath } from "next/cache";

export async function saveDebtDetailAction(accountId: string, interestRate: number, minimumPayment: number) {
  const result = await saveDebtDetail(accountId, interestRate, minimumPayment);
  revalidatePath("/debts");
  revalidatePath("/net-worth");
  revalidatePath("/");
  return { success: true, data: result };
}
