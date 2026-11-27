"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [aiBaseUrl, setAiBaseUrl] = useState(initialSettings?.aiBaseUrl || "");
  const [aiApiKey, setAiApiKey] = useState(initialSettings?.aiApiKey || "");
  const [aiModel, setAiModel] = useState(initialSettings?.aiModel || "");
  const [thinkingEnabled, setThinkingEnabled] = useState(initialSettings?.aiThinkingEnabled ?? false);

  const [models, setModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [manualModelMode, setManualModelMode] = useState(false);

  const discoverModels = useCallback(async (urlToUse: string, keyToUse: string) => {
    if (!urlToUse.trim()) {
      setDiscoveryStatus({ type: "error", text: "Enter an AI Base URL first." });
      return;
    }

    setIsLoadingModels(true);
    setDiscoveryStatus(null);
    try {
      const res = await fetch("/api/v1/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: urlToUse.trim(), apiKey: keyToUse.trim() }),
      });
      const data = (await res.json()) as { models?: string[]; error?: string };

      if (!res.ok || !Array.isArray(data.models)) {
        setDiscoveryStatus({ type: "error", text: data.error || "Could not load models." });
        return;
      }

      setModels(data.models);
      if (data.models.length > 0) {
        setManualModelMode(false);
        setDiscoveryStatus({ type: "success", text: `✓ ${data.models.length} models found` });
      } else {
        setDiscoveryStatus({ type: "error", text: "Endpoint returned 0 models — enter manually." });
        setManualModelMode(true);
      }
    } catch {
      setDiscoveryStatus({ type: "error", text: "Failed to contact model discovery endpoint." });
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    if (initialSettings?.aiEnabled && initialSettings?.aiBaseUrl) {
      discoverModels(initialSettings.aiBaseUrl, initialSettings.aiApiKey || "");
    }
  }, [discoverModels, initialSettings?.aiEnabled, initialSettings?.aiBaseUrl, initialSettings?.aiApiKey]);

  const dropdownOptions =
    aiModel && !models.includes(aiModel) ? [aiModel, ...models] : models;

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
            <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              <div className="settings-grid-2">
                <Input
                  label="AI Base URL"
                  type="text"
                  id="aiBaseUrl"
                  name="aiBaseUrl"
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  helpText="OpenAI-compatible Base URL (e.g. OpenAI, Open WebUI, or Ollama)."
                />

                <Input
                  label="AI API Key"
                  type="password"
                  id="aiApiKey"
                  name="aiApiKey"
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  placeholder="Enter your AI API Key..."
                  helpText="Authentication key for the AI provider."
                />

                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                    <label htmlFor="aiModel">AI Model</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => discoverModels(aiBaseUrl, aiApiKey)}
                        disabled={isLoadingModels || !aiBaseUrl.trim()}
                        style={{
                          background: "rgba(99, 102, 241, 0.14)",
                          border: "1px solid rgba(99, 102, 241, 0.3)",
                          color: "var(--primary)",
                          borderRadius: "6px",
                          padding: "2px 8px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: isLoadingModels ? "wait" : "pointer",
                        }}
                      >
                        {isLoadingModels ? "⏳ Loading..." : "🔄 Refresh Models"}
                      </button>
                      {models.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setManualModelMode((v) => !v)}
                          style={{
                            background: "transparent",
                            border: "1px solid var(--glass-border)",
                            color: "var(--text-dim)",
                            borderRadius: "6px",
                            padding: "2px 8px",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          {manualModelMode ? "Use List" : "Manual"}
                        </button>
                      )}
                    </div>
                  </div>

                  {!manualModelMode && dropdownOptions.length > 0 ? (
                    <select
                      id="aiModel"
                      name="aiModel"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      className="settings-select"
                    >
                      {!aiModel && <option value="">Select a model...</option>}
                      {dropdownOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}{m === aiModel && !models.includes(m) ? " (saved)" : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      id="aiModel"
                      name="aiModel"
                      value={aiModel}
                      onChange={(e) => setAiModel(e.target.value)}
                      placeholder="gpt-4o or gemma4:e4b"
                    />
                  )}

                  <p className="help-text">
                    {discoveryStatus ? (
                      <span style={{ color: discoveryStatus.type === "success" ? "var(--accent)" : "var(--danger)" }}>
                        {discoveryStatus.text}
                      </span>
                    ) : (
                      "Click Refresh Models to discover available models from your endpoint."
                    )}
                  </p>
                </div>

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

              <div
                className="settings-grid-2"
                style={{ paddingTop: "1.25rem", borderTop: "1px dashed var(--glass-border)", alignItems: "center" }}
              >
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
                    <span className="settings-toggle-label" style={{ color: "var(--text-main)" }}>
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
