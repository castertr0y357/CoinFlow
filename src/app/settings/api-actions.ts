"use server";

import prisma from "@/lib/prisma";
import { createApiKey } from "@/lib/services/auth";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const GenerateNewKeySchema = z.object({
  name: z.string().min(1),
});

const RevokeKeySchema = z.object({
  id: z.string().min(1),
});

export async function generateNewKey(name: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = GenerateNewKeySchema.parse({ name });
    // For now, we use the first user as the owner.
    const user = await prisma.user.findFirst();
    if (!user) throw new Error("No user found. Please run seed.");

    const rawKey = await createApiKey(user.id, parsed.name);
    
    revalidatePath("/settings");
    return rawKey;
  } catch (error) {
    console.error("[API ACTION ERROR] generateNewKey failed:", error);
    throw error;
  }
}

export async function revokeKey(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = RevokeKeySchema.parse({ id });
    await prisma.apiKey.delete({ where: { id: parsed.id } });
    revalidatePath("/settings");
  } catch (error) {
    console.error("[API ACTION ERROR] revokeKey failed:", error);
    throw error;
  }
}

