"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { updateAiSettingsAction } from "./actions";

interface AiSettingsFormProps {
  initialSettings: {
    aiEnabled: boolean;
    aiBaseUrl: string | null;
    aiApiKey: string | null;
    aiModel: string | null;
    aiChatId: string | null;
    aiThinkingEnabled: boolean;
    aiThinkingEffort: string | null;
  } | null;
}

export default function AiSettingsForm({ initialSettings }: AiSettingsFormProps) {
  const [aiEnabled, setAiEnabled] = useState(initialSettings?.aiEnabled ?? false);
  const [thinkingEnabled, setThinkingEnabled] = useState(initialSettings?.aiThinkingEnabled ?? false);

  return (
    <form action={updateAiSettingsAction}>
      <Card className="settings-form">
        <div className="form-section">
          <h2>AI Assistant</h2>
          
          <div className="form-group checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              id="aiEnabled" 
              name="aiEnabled" 
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent)' }}
            />
            <label htmlFor="aiEnabled" style={{ cursor: 'pointer', margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
              Enable AI Features
            </label>
          </div>
          
          {aiEnabled && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <Input 
                label="AI Base URL"
                type="text" 
                id="aiBaseUrl" 
                name="aiBaseUrl" 
                defaultValue={initialSettings?.aiBaseUrl || ""} 
                placeholder="https://api.openai.com/v1"
                helpText="OpenAI-compatible Base URL (e.g. https://api.openai.com/v1, or http://localhost:11434/v1 for Ollama)."
              />

              <Input 
                label="AI API Key"
                type="password" 
                id="aiApiKey" 
                name="aiApiKey" 
                defaultValue={initialSettings?.aiApiKey || ""} 
                placeholder="Enter your AI API Key..." 
                helpText="Authentication key for the AI provider."
              />

              <Input 
                label="AI Model"
                type="text" 
                id="aiModel" 
                name="aiModel" 
                defaultValue={initialSettings?.aiModel || ""} 
                placeholder="gpt-4o"
                helpText="Model name to target (e.g., gpt-4o, llama-3, etc.)."
              />

              <Input 
                label="AI Chat ID (Optional)"
                type="text" 
                id="aiChatId" 
                name="aiChatId" 
                defaultValue={initialSettings?.aiChatId || ""} 
                placeholder="webbudget-session-id"
                helpText="Optional Open WebUI session persistence chat ID."
              />

              <div style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--glass-border)' }}>
                <div className="form-group checkbox-group" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    id="aiThinkingEnabled" 
                    name="aiThinkingEnabled" 
                    checked={thinkingEnabled}
                    onChange={(e) => setThinkingEnabled(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                  />
                  <label htmlFor="aiThinkingEnabled" style={{ cursor: 'pointer', margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                    Enable Thinking/Reasoning
                  </label>
                </div>

                {thinkingEnabled && (
                  <div className="form-group animate-fade-in">
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Thinking Effort</label>
                    <select 
                      name="aiThinkingEffort" 
                      defaultValue={initialSettings?.aiThinkingEffort || "medium"}
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
                )}
              </div>
            </div>
          )}
        </div>

        <div className="form-actions">
          <Button type="submit">Save Changes</Button>
        </div>
      </Card>
    </form>
  );
}
