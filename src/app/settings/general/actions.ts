"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { z } from "zod";
import { isSafeUrl } from "@/lib/security";

const UpdateBudgetIncomeSchema = z.object({
  savingsTarget: z.number().min(0),
  monthlyIncome: z.number().min(0),
  savingsCategoryId: z.string().nullable().optional(),
  paycheckEnabled: z.boolean(),
  paycheckFrequency: z.enum(["WEEKLY", "BI_WEEKLY", "SEMI_MONTHLY", "MONTHLY"]),
  paycheckAmount: z.number().min(0),
  paycheckNextDate: z.union([z.date(), z.string()]).nullable().optional().transform(val => val ? new Date(val) : null),
});

const UpdateIntegrationsSchema = z.object({
  simpleFinToken: z.string().nullable().optional(),
  rentcastApiKey: z.string().nullable().optional(),
});

export async function updateBudgetIncomeSettingsAction(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const target = parseFloat(formData.get("savingsTarget") as string);
    const income = parseFloat(formData.get("expectedMonthlyIncome") as string);
    const savingsCategoryId = formData.get("savingsCategoryId") as string;

    const paycheckEnabled = formData.get("paycheckEnabled") === "on";
    const paycheckFrequency = formData.get("paycheckFrequency") as string;
    const paycheckAmount = parseFloat(formData.get("paycheckAmount") as string);
    const paycheckNextDateStr = formData.get("paycheckNextDate") as string;
    const paycheckNextDate = paycheckNextDateStr ? new Date(paycheckNextDateStr + "T00:00:00") : null;

    const parsed = UpdateBudgetIncomeSchema.parse({
      savingsTarget: isNaN(target) ? 0 : target,
      monthlyIncome: isNaN(income) ? 5000 : income,
      savingsCategoryId: savingsCategoryId || null,
      paycheckEnabled,
      paycheckFrequency: paycheckFrequency || "BI_WEEKLY",
      paycheckAmount: isNaN(paycheckAmount) ? 0 : paycheckAmount,
      paycheckNextDate,
    });

    await prisma.settings.upsert({
      where: { id: 'global' },
      update: {
        savingsTarget: parsed.savingsTarget,
        monthlyIncome: parsed.monthlyIncome,
        savingsCategoryId: parsed.savingsCategoryId,
        paycheckEnabled: parsed.paycheckEnabled,
        paycheckFrequency: parsed.paycheckFrequency,
        paycheckAmount: parsed.paycheckAmount,
        paycheckNextDate: parsed.paycheckNextDate,
      },
      create: {
        id: 'global',
        savingsTarget: parsed.savingsTarget,
        monthlyIncome: parsed.monthlyIncome,
        savingsCategoryId: parsed.savingsCategoryId,
        paycheckEnabled: parsed.paycheckEnabled,
        paycheckFrequency: parsed.paycheckFrequency,
        paycheckAmount: parsed.paycheckAmount,
        paycheckNextDate: parsed.paycheckNextDate,
      }
    });

    revalidatePath("/settings/general");
    revalidatePath("/");
  } catch (error) {
    console.error("[SETTINGS ACTION ERROR] updateBudgetIncomeSettingsAction failed:", error);
    throw error;
  }
}

export async function updateIntegrationsSettingsAction(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const token = formData.get("simpleFinToken") as string;
    const rentcastApiKey = formData.get("rentcastApiKey") as string;

    const parsed = UpdateIntegrationsSchema.parse({
      simpleFinToken: token || null,
      rentcastApiKey: rentcastApiKey || null,
    });

    if (parsed.simpleFinToken && !parsed.simpleFinToken.startsWith('https://user:')) {
      let claimUrl = parsed.simpleFinToken;
      if (!parsed.simpleFinToken.startsWith('https://')) {
        try {
          const decoded = Buffer.from(parsed.simpleFinToken, 'base64').toString('utf-8');
          if (decoded.startsWith('https://')) {
            claimUrl = decoded;
          }
        } catch {}
      }

      if (claimUrl.includes('/claim/')) {
        if (!(await isSafeUrl(claimUrl))) {
          throw new Error("Invalid or unsafe SimpleFIN Bridge URL (SSRF detection)");
        }

        try {
          const claimResponse = await fetch(claimUrl, { method: 'POST' });
          if (claimResponse.ok) {
            const accessUrl = await claimResponse.text();
            if (accessUrl && accessUrl.startsWith('https')) {
              if (!(await isSafeUrl(accessUrl))) {
                throw new Error("Unsafe resolved access URL (SSRF detection)");
              }
              parsed.simpleFinToken = accessUrl;
            }
          }
        } catch (err) {
          console.error("SimpleFIN claim fetch failed:", err);
          throw new Error("Failed to claim SimpleFIN token from the bridge URL.");
        }
      }
    }

    await prisma.settings.upsert({
      where: { id: 'global' },
      update: {
        simpleFinToken: parsed.simpleFinToken,
        rentcastApiKey: parsed.rentcastApiKey,
      },
      create: {
        id: 'global',
        simpleFinToken: parsed.simpleFinToken,
        rentcastApiKey: parsed.rentcastApiKey,
      }
    });

    revalidatePath("/settings/integrations");
    revalidatePath("/settings/general");
    revalidatePath("/");
  } catch (error) {
    console.error("[SETTINGS ACTION ERROR] updateIntegrationsSettingsAction failed:", error);
    throw error;
  }
}
