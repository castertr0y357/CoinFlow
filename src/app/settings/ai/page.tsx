import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default async function AiSettingsPage() {
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });

  async function updateAiSettings(formData: FormData) {
    "use server";

    const aiEnabled = formData.get("aiEnabled") === "on";
    const aiBaseUrl = formData.get("aiBaseUrl") as string;
    const aiApiKey = formData.get("aiApiKey") as string;
    const aiModel = formData.get("aiModel") as string;
    const aiChatId = formData.get("aiChatId") as string;
    const aiThinkingEnabled = formData.get("aiThinkingEnabled") === "on";
    const aiThinkingEffort = formData.get("aiThinkingEffort") as string;

    await prisma.settings.upsert({
      where: { id: 'global' },
      update: {
        aiEnabled,
        aiBaseUrl: aiBaseUrl || null,
        aiApiKey: aiApiKey || null,
        aiModel: aiModel || null,
        aiChatId: aiChatId || null,
        aiThinkingEnabled,
        aiThinkingEffort: aiThinkingEffort || null,
      },
      create: {
        id: 'global',
        aiEnabled,
        aiBaseUrl: aiBaseUrl || null,
        aiApiKey: aiApiKey || null,
        aiModel: aiModel || null,
        aiChatId: aiChatId || null,
        aiThinkingEnabled,
        aiThinkingEffort: aiThinkingEffort || null,
      }
    });

    revalidatePath("/settings/ai");
    revalidatePath("/");
  }

  return (
    <div className="subpage-container animate-fade-in">
      <form action={updateAiSettings}>
        <Card className="settings-form">
          <div className="form-section">
            <h2>AI Assistant</h2>
            
            <div className="form-group checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                id="aiEnabled" 
                name="aiEnabled" 
                defaultChecked={settings?.aiEnabled || false}
                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent)' }}
              />
              <label htmlFor="aiEnabled" style={{ cursor: 'pointer', margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                Enable AI Features
              </label>
            </div>
            
            <Input 
              label="AI Base URL"
              type="text" 
              id="aiBaseUrl" 
              name="aiBaseUrl" 
              defaultValue={settings?.aiBaseUrl || ""} 
              placeholder="https://api.openai.com/v1"
              helpText="OpenAI-compatible Base URL (e.g. https://api.openai.com/v1, or http://localhost:11434/v1 for Ollama)."
            />

            <Input 
              label="AI API Key"
              type="password" 
              id="aiApiKey" 
              name="aiApiKey" 
              defaultValue={settings?.aiApiKey || ""} 
              placeholder="Enter your AI API Key..." 
              helpText="Authentication key for the AI provider."
            />

            <Input 
              label="AI Model"
              type="text" 
              id="aiModel" 
              name="aiModel" 
              defaultValue={settings?.aiModel || ""} 
              placeholder="gpt-4o"
              helpText="Model name to target (e.g., gpt-4o, llama-3, etc.)."
            />

            <Input 
              label="AI Chat ID (Optional)"
              type="text" 
              id="aiChatId" 
              name="aiChatId" 
              defaultValue={settings?.aiChatId || ""} 
              placeholder="webbudget-session-id"
              helpText="Optional Open WebUI session persistence chat ID."
            />

            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed var(--glass-border)' }}>
              <div className="form-group checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  id="aiThinkingEnabled" 
                  name="aiThinkingEnabled" 
                  defaultChecked={settings?.aiThinkingEnabled || false}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                />
                <label htmlFor="aiThinkingEnabled" style={{ cursor: 'pointer', margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  Enable Thinking/Reasoning
                </label>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Thinking Effort</label>
                <select 
                  name="aiThinkingEffort" 
                  defaultValue={settings?.aiThinkingEffort || "medium"}
                  className="settings-select"
                >
                  <option value="low">Low (Faster, lower token usage)</option>
                  <option value="medium">Medium (Balanced quality and latency)</option>
                  <option value="high">High (Maximum reasoning depth)</option>
                </select>
                <p className="help-text" style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Adjust the internal reasoning effort allocated for models that support it (e.g. OpenAI o1/o3-mini).
                </p>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <Button type="submit">Save Changes</Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
