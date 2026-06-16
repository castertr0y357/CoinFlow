"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const UpdateAiSettingsSchema = z.object({
  aiEnabled: z.boolean(),
  aiBaseUrl: z.string().nullable().optional(),
  aiApiKey: z.string().nullable().optional(),
  aiModel: z.string().nullable().optional(),
  aiChatId: z.string().nullable().optional(),
  aiThinkingEnabled: z.boolean(),
  aiThinkingEffort: z.enum(["low", "medium", "high"]),
});

export async function updateAiSettingsAction(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  try {
    const aiEnabled = formData.get("aiEnabled") === "on";
    const aiBaseUrl = formData.get("aiBaseUrl") as string;
    const aiApiKey = formData.get("aiApiKey") as string;
    const aiModel = formData.get("aiModel") as string;
    const aiChatId = formData.get("aiChatId") as string;
    const aiThinkingEnabled = formData.get("aiThinkingEnabled") === "on";
    const aiThinkingEffort = formData.get("aiThinkingEffort") as string;

    const parsed = UpdateAiSettingsSchema.parse({
      aiEnabled,
      aiBaseUrl: aiBaseUrl || null,
      aiApiKey: aiApiKey || null,
      aiModel: aiModel || null,
      aiChatId: aiChatId || null,
      aiThinkingEnabled,
      aiThinkingEffort: aiThinkingEffort || "medium",
    });

    await prisma.settings.upsert({
      where: { id: 'global' },
      update: {
        aiEnabled: parsed.aiEnabled,
        aiBaseUrl: parsed.aiBaseUrl,
        aiApiKey: parsed.aiApiKey,
        aiModel: parsed.aiModel,
        aiChatId: parsed.aiChatId,
        aiThinkingEnabled: parsed.aiThinkingEnabled,
        aiThinkingEffort: parsed.aiThinkingEffort,
      },
      create: {
        id: 'global',
        aiEnabled: parsed.aiEnabled,
        aiBaseUrl: parsed.aiBaseUrl,
        aiApiKey: parsed.aiApiKey,
        aiModel: parsed.aiModel,
        aiChatId: parsed.aiChatId,
        aiThinkingEnabled: parsed.aiThinkingEnabled,
        aiThinkingEffort: parsed.aiThinkingEffort,
      }
    });

    revalidatePath("/settings/ai");
    revalidatePath("/");
  } catch (error) {
    console.error("[SETTINGS ACTION ERROR] updateAiSettingsAction failed:", error);
    throw error;
  }
}
