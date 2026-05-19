"use server";

import { addGoal, updateGoal, deleteGoal, adjustManualGoalAmount } from "@/lib/services/goalService";
import { revalidatePath } from "next/cache";

export async function addGoalAction(data: {
  name: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: Date | null;
  categoryId?: string | null;
  createCategory?: boolean;
}) {
  const result = await addGoal(data);
  revalidatePath("/goals");
  revalidatePath("/");
  return result;
}

export async function updateGoalAction(id: string, data: {
  name?: string;
  targetAmount?: number;
  targetDate?: Date | null;
  categoryId?: string | null;
  isCompleted?: boolean;
}) {
  const result = await updateGoal(id, data);
  revalidatePath("/goals");
  revalidatePath("/");
  return result;
}

export async function deleteGoalAction(id: string) {
  const result = await deleteGoal(id);
  revalidatePath("/goals");
  revalidatePath("/");
  return result;
}

export async function adjustManualGoalAmountAction(id: string, amount: number) {
  const result = await adjustManualGoalAmount(id, amount);
  revalidatePath("/goals");
  revalidatePath("/");
  return result;
}
