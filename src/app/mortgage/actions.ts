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
  originalBalance?: number;
  address?: string;
}) {
  const mortgage = await prisma.mortgageDetail.upsert({
    where: { accountId: data.accountId },
    update: {
      interestRate: data.interestRate,
      monthlyPayment: data.monthlyPayment,
      startDate: new Date(data.startDate),
      termMonths: data.termMonths,
      homeValue: data.homeValue,
      originalBalance: data.originalBalance,
      address: data.address || null,
    },
    create: {
      accountId: data.accountId,
      interestRate: data.interestRate,
      monthlyPayment: data.monthlyPayment,
      startDate: new Date(data.startDate),
      termMonths: data.termMonths,
      homeValue: data.homeValue,
      originalBalance: data.originalBalance,
      address: data.address || null,
    },
  });

  if (data.address) {
    const existingRentCastProvider = await prisma.homeValueProvider.findFirst({
      where: {
        mortgageId: mortgage.id,
        name: "RentCast"
      }
    });

    if (!existingRentCastProvider) {
      await prisma.homeValueProvider.create({
        data: {
          mortgageId: mortgage.id,
          name: "RentCast",
          url: "https://api.rentcast.io/v1/avm/value"
        }
      });
    }

    const existingTaxProvider = await prisma.homeValueProvider.findFirst({
      where: {
        mortgageId: mortgage.id,
        name: "RentCast Tax Assessment"
      }
    });

    if (!existingTaxProvider) {
      await prisma.homeValueProvider.create({
        data: {
          mortgageId: mortgage.id,
          name: "RentCast Tax Assessment",
          url: "https://api.rentcast.io/v1/properties"
        }
      });
    }
  }

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
