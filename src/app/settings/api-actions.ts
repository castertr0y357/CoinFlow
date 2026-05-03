"use server";

import prisma from "@/lib/prisma";
import { createApiKey } from "@/lib/services/auth";
import { revalidatePath } from "next/cache";

export async function generateNewKey(name: string) {
  // For now, we use the first user as the owner.
  const user = await prisma.user.findFirst();
  if (!user) throw new Error("No user found. Please run seed.");

  const rawKey = await createApiKey(user.id, name);
  
  revalidatePath("/settings");
  return rawKey;
}

export async function revokeKey(id: string) {
  await prisma.apiKey.delete({ where: { id } });
  revalidatePath("/settings");
}
