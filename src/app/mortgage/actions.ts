"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { syncAllValuations } from "@/lib/services/valuationService";
import { getSession } from "@/lib/auth";
import { z } from "zod";
import { isSafeUrl } from "@/lib/security";

const UpdateMortgageSchema = z.object({
  accountId: z.string().min(1),
  interestRate: z.number().min(0).max(100),
  monthlyPayment: z.number().min(0),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), "Invalid start date"),
  termMonths: z.number().int().min(1),
  manualHomeValue: z.number().min(0).nullable().optional(),
  originalBalance: z.number().min(0).optional(),
  address: z.string().nullable().optional(),
});

const AddValuationProviderSchema = z.object({
  mortgageId: z.string().min(1),
  name: z.string().min(1),
  url: z.string().url(),
});

const RemoveValuationProviderSchema = z.object({
  providerId: z.string().min(1),
});

const SyncValuationsSchema = z.object({
  mortgageId: z.string().min(1),
});

export async function updateMortgageDetails(data: {
  accountId: string;
  interestRate: number;
  monthlyPayment: number;
  startDate: string;
  termMonths: number;
  manualHomeValue?: number;
  originalBalance?: number;
  address?: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = UpdateMortgageSchema.parse(data);

    const mortgage = await prisma.mortgageDetail.upsert({
      where: { accountId: parsed.accountId },
      update: {
        interestRate: parsed.interestRate,
        monthlyPayment: parsed.monthlyPayment,
        startDate: new Date(parsed.startDate),
        termMonths: parsed.termMonths,
        manualHomeValue: parsed.manualHomeValue ?? null,
        originalBalance: parsed.originalBalance,
        address: parsed.address || null,
      },
      create: {
        accountId: parsed.accountId,
        interestRate: parsed.interestRate,
        monthlyPayment: parsed.monthlyPayment,
        startDate: new Date(parsed.startDate),
        termMonths: parsed.termMonths,
        manualHomeValue: parsed.manualHomeValue ?? null,
        originalBalance: parsed.originalBalance,
        address: parsed.address || null,
      },
    });

    if (parsed.address) {
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
  } catch (error) {
    console.error("[MORTGAGE ACTION ERROR] updateMortgageDetails failed:", error);
    throw error;
  }
}

export async function addValuationProvider(mortgageId: string, name: string, url: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = AddValuationProviderSchema.parse({ mortgageId, name, url });

    if (!(await isSafeUrl(parsed.url))) {
      throw new Error("Invalid or unsafe destination URL (SSRF detection)");
    }

    await prisma.homeValueProvider.create({
      data: {
        mortgageId: parsed.mortgageId,
        name: parsed.name,
        url: parsed.url,
      }
    });
    revalidatePath("/mortgage");
  } catch (error) {
    console.error("[MORTGAGE ACTION ERROR] addValuationProvider failed:", error);
    throw error;
  }
}

export async function removeValuationProvider(providerId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = RemoveValuationProviderSchema.parse({ providerId });
    await prisma.homeValueProvider.delete({
      where: { id: parsed.providerId }
    });
    revalidatePath("/mortgage");
  } catch (error) {
    console.error("[MORTGAGE ACTION ERROR] removeValuationProvider failed:", error);
    throw error;
  }
}

export async function syncValuations(mortgageId: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const parsed = SyncValuationsSchema.parse({ mortgageId });
    await syncAllValuations(parsed.mortgageId);
    revalidatePath("/mortgage");
  } catch (error) {
    console.error("[MORTGAGE ACTION ERROR] syncValuations failed:", error);
    throw error;
  }
}

