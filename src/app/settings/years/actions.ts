"use server";

import { revalidatePath } from "next/cache";
import { deleteHistoricalYear, DeleteYearResult } from "@/lib/services/yearService";

export async function deleteHistoricalYearAction(
  year: number,
  cleanupEmptyArchivedCategories: boolean = true
): Promise<DeleteYearResult> {
  const result = await deleteHistoricalYear(year, {
    cleanupEmptyArchivedCategories,
  });

  revalidatePath("/settings/years");
  revalidatePath("/settings/categories");
  revalidatePath("/");
  revalidatePath("/transactions");

  return result;
}
