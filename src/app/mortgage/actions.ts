"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { syncAllValuations } from "@/lib/services/valuationService";

export async function updateMortgageDetails(data: {
  accountId: string;
  interestRate: number;
  monthlyPayment: number;
  startDate: string;
  termMonths: number;
  homeValue?: number;
}) {
  await prisma.mortgageDetail.upsert({
    where: { accountId: data.accountId },
    update: {
      interestRate: data.interestRate,
      monthlyPayment: data.monthlyPayment,
      startDate: new Date(data.startDate),
      termMonths: data.termMonths,
      homeValue: data.homeValue,
    },
    create: {
      accountId: data.accountId,
      interestRate: data.interestRate,
      monthlyPayment: data.monthlyPayment,
      startDate: new Date(data.startDate),
      termMonths: data.termMonths,
      homeValue: data.homeValue,
    },
  });

  revalidatePath("/mortgage");
  revalidatePath("/");
}

export async function addValuationProvider(mortgageId: string, name: string, url: string) {
  await prisma.homeValueProvider.create({
    data: {
      mortgageId,
      name,
      url
    }
  });
  revalidatePath("/mortgage");
}

export async function removeValuationProvider(providerId: string) {
  await prisma.homeValueProvider.delete({
    where: { id: providerId }
  });
  revalidatePath("/mortgage");
}

export async function syncValuations(mortgageId: string) {
  await syncAllValuations(mortgageId);
  revalidatePath("/mortgage");
}
