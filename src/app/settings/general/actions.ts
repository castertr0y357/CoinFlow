"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { z } from "zod";
import { isSafeUrl } from "@/lib/security";

const UpdateSettingsSchema = z.object({
  savingsTarget: z.number().min(0),
  monthlyIncome: z.number().min(0),
  backupRetentionDays: z.number().int().min(1),
  savingsCategoryId: z.string().nullable().optional(),
  simpleFinToken: z.string().nullable().optional(),
  rentcastApiKey: z.string().nullable().optional(),
  paycheckEnabled: z.boolean(),
  paycheckFrequency: z.enum(["WEEKLY", "BI_WEEKLY", "SEMI_MONTHLY", "MONTHLY"]),
  paycheckAmount: z.number().min(0),
  paycheckNextDate: z.union([z.date(), z.string()]).nullable().optional().transform(val => val ? new Date(val) : null),
});

export async function updateSettingsAction(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const target = parseFloat(formData.get("savingsTarget") as string);
    const income = parseFloat(formData.get("expectedMonthlyIncome") as string);
    const retention = parseInt(formData.get("backupRetentionDays") as string);
    const savingsCategoryId = formData.get("savingsCategoryId") as string;
    let token = formData.get("simpleFinToken") as string;
    const rentcastApiKey = formData.get("rentcastApiKey") as string;

    const paycheckEnabled = formData.get("paycheckEnabled") === "on";
    const paycheckFrequency = formData.get("paycheckFrequency") as string;
    const paycheckAmount = parseFloat(formData.get("paycheckAmount") as string);
    const paycheckNextDateStr = formData.get("paycheckNextDate") as string;
    const paycheckNextDate = paycheckNextDateStr ? new Date(paycheckNextDateStr + "T00:00:00") : null;

    const parsed = UpdateSettingsSchema.parse({
      savingsTarget: isNaN(target) ? 0 : target,
      monthlyIncome: isNaN(income) ? 5000 : income,
      backupRetentionDays: isNaN(retention) ? 30 : retention,
      savingsCategoryId: savingsCategoryId || null,
      simpleFinToken: token || null,
      rentcastApiKey: rentcastApiKey || null,
      paycheckEnabled,
      paycheckFrequency: paycheckFrequency || "BI_WEEKLY",
      paycheckAmount: isNaN(paycheckAmount) ? 0 : paycheckAmount,
      paycheckNextDate,
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
        savingsTarget: parsed.savingsTarget,
        monthlyIncome: parsed.monthlyIncome,
        backupRetentionDays: parsed.backupRetentionDays,
        savingsCategoryId: parsed.savingsCategoryId,
        simpleFinToken: parsed.simpleFinToken,
        paycheckEnabled: parsed.paycheckEnabled,
        paycheckFrequency: parsed.paycheckFrequency,
        paycheckAmount: parsed.paycheckAmount,
        paycheckNextDate: parsed.paycheckNextDate,
        rentcastApiKey: parsed.rentcastApiKey,
      },
      create: {
        id: 'global',
        savingsTarget: parsed.savingsTarget,
        monthlyIncome: parsed.monthlyIncome,
        backupRetentionDays: parsed.backupRetentionDays,
        savingsCategoryId: parsed.savingsCategoryId,
        simpleFinToken: parsed.simpleFinToken,
        paycheckEnabled: parsed.paycheckEnabled,
        paycheckFrequency: parsed.paycheckFrequency,
        paycheckAmount: parsed.paycheckAmount,
        paycheckNextDate: parsed.paycheckNextDate,
        rentcastApiKey: parsed.rentcastApiKey,
      }
    });

    revalidatePath("/settings/general");
    revalidatePath("/");
  } catch (error) {
    console.error("[SETTINGS ACTION ERROR] updateSettingsAction failed:", error);
    throw error;
  }
}
