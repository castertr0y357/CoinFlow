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
          <div className="section-header-row">
            <h2>AI Assistant</h2>
            <label className="settings-toggle" htmlFor="aiEnabled">
              <input
                type="checkbox"
                id="aiEnabled"
                name="aiEnabled"
                checked={aiEnabled}
                onChange={(e) => setAiEnabled(e.target.checked)}
              />
              <span className="settings-toggle-slider" />
              <span className="settings-toggle-label">
                {aiEnabled ? "Enabled" : "Disabled"}
              </span>
            </label>
          </div>
          
          {aiEnabled && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="settings-grid-2">
                <Input 
                  label="AI Base URL"
                  type="text" 
                  id="aiBaseUrl" 
                  name="aiBaseUrl" 
                  defaultValue={initialSettings?.aiBaseUrl || ""} 
                  placeholder="https://api.openai.com/v1"
                  helpText="OpenAI-compatible Base URL (e.g. OpenAI or Ollama)."
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
                  helpText="Model name to target (e.g., gpt-4o, gemma4:e4b)."
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
              </div>

              <div className="settings-grid-2" style={{ paddingTop: '1.25rem', borderTop: '1px dashed var(--glass-border)', alignItems: 'center' }}>
                <div className="form-group">
                  <label className="settings-toggle" htmlFor="aiThinkingEnabled">
                    <input 
                      type="checkbox" 
                      id="aiThinkingEnabled" 
                      name="aiThinkingEnabled" 
                      checked={thinkingEnabled}
                      onChange={(e) => setThinkingEnabled(e.target.checked)}
                    />
                    <span className="settings-toggle-slider" />
                    <span className="settings-toggle-label" style={{ color: 'var(--text-main)' }}>
                      Enable Thinking / Reasoning
                    </span>
                  </label>
                  <p className="help-text">
                    Enable extended reasoning for models that support thinking effort levels.
                  </p>
                </div>

                {thinkingEnabled && (
                  <div className="form-group animate-fade-in">
                    <label htmlFor="aiThinkingEffort">Thinking Effort</label>
                    <select 
                      id="aiThinkingEffort"
                      name="aiThinkingEffort" 
                      defaultValue={initialSettings?.aiThinkingEffort || "medium"}
                      className="settings-select"
                    >
                      <option value="low">Low (Faster, lower token usage)</option>
                      <option value="medium">Medium (Balanced quality and latency)</option>
                      <option value="high">High (Maximum reasoning depth)</option>
                    </select>
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
