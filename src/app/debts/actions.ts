"use server";

import { saveDebtDetail } from "@/lib/services/debtService";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const SaveDebtDetailSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  interestRate: z.number().min(0, "Interest rate cannot be negative").max(100, "Interest rate cannot exceed 100%"),
  minimumPayment: z.number().min(0, "Minimum payment cannot be negative"),
  remainingPayments: z.number().int().min(0, "Remaining payments cannot be negative").nullable().optional(),
});

export async function saveDebtDetailAction(
  accountId: string,
  interestRate: number,
  minimumPayment: number,
  remainingPayments?: number | null
) {
  // 1. Authorization check
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // 2. Input validation
    const parsed = SaveDebtDetailSchema.parse({
      accountId,
      interestRate,
      minimumPayment,
      remainingPayments,
    });

    // 3. Database operations
    const result = await saveDebtDetail(
      parsed.accountId,
      parsed.interestRate,
      parsed.minimumPayment,
      parsed.remainingPayments
    );
    
    // 4. Cache revalidation
    revalidatePath("/debts");
    revalidatePath("/net-worth");
    revalidatePath("/");
    
    return { success: true, data: JSON.parse(JSON.stringify(result)) };
  } catch (error) {
    console.error("[DEBT ACTION ERROR] saveDebtDetailAction failed:", error);
    
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message || "Validation failed" };
    }
    
    const errMsg = error instanceof Error ? error.message : "An unexpected error occurred";
    return { success: false, error: errMsg };
  }
}
