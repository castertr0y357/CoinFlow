"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addCommitment(data: {
  name: string;
  amount: number;
  frequency: string;
  type: string;
  categoryId?: string;
  nextDueDate?: Date;
}) {
  await prisma.commitment.create({
    data: {
      name: data.name,
      amount: data.amount,
      frequency: data.frequency,
      type: data.type,
      categoryId: data.categoryId || null,
      nextDueDate: data.nextDueDate || null,
    }
  });
  revalidatePath("/commitments");
  revalidatePath("/");
}

export async function deleteCommitment(id: string) {
  await prisma.commitment.delete({ where: { id } });
  revalidatePath("/commitments");
  revalidatePath("/");
}

export async function updateCommitment(id: string, data: any) {
  await prisma.commitment.update({
    where: { id },
    data
  });
  revalidatePath("/commitments");
  revalidatePath("/");
}
