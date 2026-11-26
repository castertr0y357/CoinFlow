"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { updateIntegrationsSettingsAction } from "../general/actions";
import { useNotification } from "@/components/ui/NotificationProvider";

interface IntegrationsClientProps {
  initialSimpleFinToken: string;
  initialRentcastApiKey: string;
}

export default function IntegrationsClient({
  initialSimpleFinToken,
  initialRentcastApiKey,
}: IntegrationsClientProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isFullSyncing, setIsFullSyncing] = useState(false);
  const { showToast } = useNotification();
  const router = useRouter();

  const handleSave = async (formData: FormData) => {
    setIsSaving(true);
    try {
      await updateIntegrationsSettingsAction(formData);
      showToast("Integration settings saved!", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save integrations", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFullYearSync = async () => {
    setIsFullSyncing(true);
    try {
      const res = await fetch("/api/v1/sync/simplefin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": process.env.NEXT_PUBLIC_INTERNAL_API_KEY || "",
        },
        body: JSON.stringify({ fullSync: true }),
      });

      if (!res.ok) {
        throw new Error(`Sync trigger failed (${res.status})`);
      }

      const { task_id: taskId } = await res.json();
      showToast("Full-year bank sync started (Jan 1st lookback)...", "info");

      if (taskId) {
        for (let attempt = 0; attempt < 60; attempt++) {
          await new Promise((r) => setTimeout(r, 1000));
          const statusRes = await fetch(`/api/v1/sync/status?taskId=${encodeURIComponent(taskId)}`, {
            headers: { "X-API-KEY": process.env.NEXT_PUBLIC_INTERNAL_API_KEY || "" },
          });
          if (!statusRes.ok) break;
          const task = await statusRes.json();
          if (task.status === "completed") {
            const newCount = task.result?.newTransactionCount ?? task.result?.transactionCount ?? 0;
            const scannedCount = task.result?.transactionCount ?? 0;
            const syncErrors: string[] = Array.isArray(task.result?.syncErrors) ? task.result.syncErrors : [];
            if (syncErrors.length > 0) {
              showToast(`Synced ${newCount} new tx, but SimpleFIN reported: ${syncErrors[0]}`, "error");
            } else {
              showToast(`Synced ${newCount} new transactions (scanned ${scannedCount})`, "success");
            }
            mutate("/api/v1/budget/tally");
            mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/v1/transactions"));
            router.refresh();
            break;
          }
          if (task.status === "failed") {
            throw new Error(task.error || "Full-year bank sync failed");
          }
        }
      }

      router.refresh();
      mutate("/api/v1/budget/tally");
      mutate((key: unknown) => typeof key === "string" && key.startsWith("/api/v1/transactions"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Full-year sync failed", "error");
    } finally {
      setIsFullSyncing(false);
    }
  };

  return (
    <form action={handleSave}>
      <div className="settings-bento-2">
        {/* Left Column: SimpleFIN Bank Sync */}
        <Card className="settings-form" style={{ gap: "1.75rem", justifyContent: "space-between" }}>
          <div className="form-section">
            <h2>SimpleFIN Bank Sync</h2>
            <Input
              label="SimpleFIN Bridge URL (Token)"
              type="password"
              id="simpleFinToken"
              name="simpleFinToken"
              defaultValue={initialSimpleFinToken}
              placeholder="https://beta-bridge.simplefin.org/simplefin/claim/..."
              helpText="Your access URL to sync bank transactions securely."
            />

            <div className="flex flex-col gap-2">
              <div>
                <Button
                  type="button"
                  variant="glass"
                  onClick={handleFullYearSync}
                  disabled={isFullSyncing}
                >
                  {isFullSyncing ? "⏳ Syncing Full Year..." : "📅 Run Full-Year Bank Sync (Jan 1st Lookback)"}
                </Button>
              </div>
              <span className="help-text">
                Pulls as far back as your bank&apos;s SimpleFIN feed provides; already-imported transactions are skipped automatically.
              </span>
            </div>

            <details className="settings-accordion" open={!initialSimpleFinToken}>
              <summary>How to get your SimpleFIN Bridge URL</summary>
              <ol className="help-steps">
                <li>
                  Go to{" "}
                  <a href="https://simplefin.org/" target="_blank" rel="noopener noreferrer">
                    SimpleFIN.org
                  </a>{" "}
                  and sign up for a <strong>Bridge</strong> account.
                </li>
                <li>Connect your bank accounts via their secure portal.</li>
                <li>Look for the &quot;Setup an App&quot; or &quot;Claim URL&quot; button.</li>
                <li>Copy the long URL and paste it above.</li>
              </ol>
            </details>
          </div>

          <div className="form-actions" style={{ paddingTop: "1.25rem" }}>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Integrations"}
            </Button>
          </div>
        </Card>

        {/* Right Column: RentCast + Browser Extension */}
        <div className="settings-bento-stack">
          <Card className="settings-form" style={{ gap: "1.5rem" }}>
            <div className="form-section">
              <h2>Property Valuation (RentCast)</h2>
              <Input
                label="RentCast API Key"
                type="password"
                id="rentcastApiKey"
                name="rentcastApiKey"
                defaultValue={initialRentcastApiKey}
                placeholder="Enter your RentCast API Key..."
                helpText="Get a free API key at developers.rentcast.io to sync property values."
              />
            </div>
          </Card>

          <Card className="settings-form" style={{ gap: "1.5rem", flex: 1 }}>
            <div className="form-section">
              <h2>Browser Extension (Purchase Sync)</h2>
              <p className="text-muted">
                Automatically sync itemized order history from Amazon, Walmart, and Lowe&apos;s directly into your budget.
              </p>

              <div className="extension-status-card glass p-5 rounded-2xl border border-primary/20">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl bg-primary/10 w-12 h-12 flex items-center justify-center rounded-xl shrink-0">
                      🧩
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-main">CoinFlow Extension v1.9</h3>
                      <p className="text-xs text-dim">
                        Load unpacked in <code>chrome://extensions/</code> with Developer Mode enabled, then paste an API key from below.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="primary" onClick={() => (window.location.href = "/coinflow-extension.zip")}>
                      Download Extension Zip
                    </Button>
                    <Button type="button" variant="glass" onClick={() => window.open("chrome://extensions")}>
                      Open Chrome Extensions
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
