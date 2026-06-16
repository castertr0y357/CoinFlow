"use server";

import { addGoal, updateGoal, deleteGoal, adjustManualGoalAmount } from "@/lib/services/goalService";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const AddGoalSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.number().min(0),
  currentAmount: z.number().min(0).optional(),
  targetDate: z.union([z.date(), z.string()]).nullable().optional().transform(val => val ? new Date(val) : null),
  categoryId: z.string().nullable().optional(),
  createCategory: z.boolean().optional(),
});

const UpdateGoalSchema = z.object({
  name: z.string().min(1).optional(),
  targetAmount: z.number().min(0).optional(),
  targetDate: z.union([z.date(), z.string()]).nullable().optional().transform(val => val ? new Date(val) : null),
  categoryId: z.string().nullable().optional(),
  isCompleted: z.boolean().optional(),
});

export async function addGoalAction(data: {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: Date | null;
  categoryId?: string | null;
  createCategory?: boolean;
}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = AddGoalSchema.parse(data);
    const result = await addGoal(parsed);
    revalidatePath("/goals");
    revalidatePath("/");
    return result;
  } catch (error) {
    console.error("[GOAL ACTION ERROR] addGoalAction failed:", error);
    throw error;
  }
}

export async function updateGoalAction(id: string, data: {
  name?: string;
  targetAmount?: number;
  targetDate?: Date | null;
  categoryId?: string | null;
  isCompleted?: boolean;
}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsedId = z.string().min(1).parse(id);
    const parsedData = UpdateGoalSchema.parse(data);
    const result = await updateGoal(parsedId, parsedData);
    revalidatePath("/goals");
    revalidatePath("/");
    return result;
  } catch (error) {
    console.error("[GOAL ACTION ERROR] updateGoalAction failed:", error);
    throw error;
  }
}

export async function deleteGoalAction(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsedId = z.string().min(1).parse(id);
    const result = await deleteGoal(parsedId);
    revalidatePath("/goals");
    revalidatePath("/");
    return result;
  } catch (error) {
    console.error("[GOAL ACTION ERROR] deleteGoalAction failed:", error);
    throw error;
  }
}

export async function adjustManualGoalAmountAction(id: string, amount: number) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsedId = z.string().min(1).parse(id);
    const parsedAmount = z.number().parse(amount);
    const result = await adjustManualGoalAmount(parsedId, parsedAmount);
    revalidatePath("/goals");
    revalidatePath("/");
    return result;
  } catch (error) {
    console.error("[GOAL ACTION ERROR] adjustManualGoalAmountAction failed:", error);
    throw error;
  }
}

