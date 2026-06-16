"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const AddCommitmentSchema = z.object({
  name: z.string().min(1),
  amount: z.number().min(0),
  frequency: z.string().min(1),
  type: z.string().min(1),
  categoryId: z.string().optional(),
  nextDueDate: z.union([z.date(), z.string()]).nullable().optional().transform(val => val ? new Date(val) : null),
});

const UpdateCommitmentSchema = z.object({
  name: z.string().min(1).optional(),
  amount: z.number().min(0).optional(),
  frequency: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  categoryId: z.string().nullable().optional(),
  nextDueDate: z.union([z.date(), z.string()]).nullable().optional().transform(val => val ? new Date(val) : null),
});

export async function addCommitment(data: {
  name: string;
  amount: number;
  frequency: string;
  type: string;
  categoryId?: string;
  nextDueDate?: Date;
}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = AddCommitmentSchema.parse(data);
    await prisma.commitment.create({
      data: {
        name: parsed.name,
        amount: parsed.amount,
        frequency: parsed.frequency,
        type: parsed.type,
        categoryId: parsed.categoryId || null,
        nextDueDate: parsed.nextDueDate || null,
      }
    });
    revalidatePath("/commitments");
    revalidatePath("/");
  } catch (error) {
    console.error("[COMMITMENT ACTION ERROR] addCommitment failed:", error);
    throw error;
  }
}

export async function deleteCommitment(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsedId = z.string().min(1).parse(id);
    await prisma.commitment.delete({ where: { id: parsedId } });
    revalidatePath("/commitments");
    revalidatePath("/");
  } catch (error) {
    console.error("[COMMITMENT ACTION ERROR] deleteCommitment failed:", error);
    throw error;
  }
}

export async function updateCommitment(
  id: string,
  data: {
    name?: string;
    amount?: number;
    frequency?: string;
    type?: string;
    categoryId?: string | null;
    nextDueDate?: Date | null;
  }
) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsedId = z.string().min(1).parse(id);
    const parsedData = UpdateCommitmentSchema.parse(data);
    await prisma.commitment.update({
      where: { id: parsedId },
      data: parsedData,
    });
    revalidatePath("/commitments");
    revalidatePath("/");
  } catch (error) {
    console.error("[COMMITMENT ACTION ERROR] updateCommitment failed:", error);
    throw error;
  }
}

