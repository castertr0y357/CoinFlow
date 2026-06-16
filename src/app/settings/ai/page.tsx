import prisma from "@/lib/prisma";
import AiSettingsForm from "./AiSettingsForm";

export default async function AiSettingsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });

  const initialSettings = settings ? {
    aiEnabled: settings.aiEnabled,
    aiBaseUrl: settings.aiBaseUrl,
    aiApiKey: settings.aiApiKey,
    aiModel: settings.aiModel,
    aiChatId: settings.aiChatId,
    aiThinkingEnabled: settings.aiThinkingEnabled,
    aiThinkingEffort: settings.aiThinkingEffort,
  } : null;

  return (
    <div className="subpage-container animate-fade-in">
      <AiSettingsForm initialSettings={initialSettings} />
    </div>
  );
}

