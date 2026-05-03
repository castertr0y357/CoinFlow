import prisma from "@/lib/prisma";
import { createHash, randomBytes } from "crypto";

export function generateKey(): string {
  return randomBytes(32).toString("hex");
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function validateApiKey(key: string) {
  const hashed = hashKey(key);
  
  const apiKey = await prisma.apiKey.findUnique({
    where: { key: hashed },
    include: { user: true }
  });

  if (!apiKey) return null;

  // Update last used timestamp
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsed: new Date() }
  });

  return apiKey.user;
}

export async function createApiKey(userId: string, name: string) {
  const rawKey = generateKey();
  const hashed = hashKey(rawKey);

  await prisma.apiKey.create({
    data: {
      key: hashed,
      name,
      userId
    }
  });

  return rawKey; // Return the raw key once to the user
}
