"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { addCommitment } from "@/app/commitments/actions";
import { useNotification } from "@/components/ui/NotificationProvider";

interface Subscription {
  name: string;
  monthlyCost: number | string;
  confidence: number | string;
  reason: string;
}

export default function SubscriptionDetective() {
  const [loading, setLoading] = useState(false);
  const [addingIndex, setAddingIndex] = useState<number | null>(null);
  const [addedNames, setAddedNames] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Subscription[] | null>(null);
  const { showToast } = useNotification();
  const router = useRouter();

  const scan = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/ai/subscriptions", {
        headers: { "X-API-KEY": process.env.NEXT_PUBLIC_INTERNAL_API_KEY || "" },
      });
      const data = await res.json();
      setResults(data.subscriptions || []);
    } catch (error) {
      console.error("Scan error:", error);
      showToast("Failed to run Subscription Detective", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCommitment = async (sub: Subscription, index: number) => {
    setAddingIndex(index);
    try {
      await addCommitment({
        name: sub.name,
        amount: Number(sub.monthlyCost) || 0,
        frequency: "MONTHLY",
        type: "SUBSCRIPTION",
      });
      setAddedNames((prev) => new Set(prev).add(sub.name));
      showToast(`Added "${sub.name}" to Commitments!`, "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to add commitment", "error");
    } finally {
      setAddingIndex(null);
    }
  };

  const formatConfidence = (conf: number | string) => {
    const num = Number(conf);
    if (!isNaN(num)) {
      const pct = Math.round(num <= 1 ? num * 100 : num);
      const level = pct >= 85 ? "high" : "medium";
      return { label: `${pct}% Confidence`, level };
    }
    const str = String(conf);
    return { label: `${str} Confidence`, level: str.toLowerCase() === "high" ? "high" : "medium" };
  };

  return (
    <div className="subscription-detective">
      <div className="detective-header flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.25rem" }}>
            🕵️ Subscription Detective
          </h2>
          <p className="text-muted" style={{ fontSize: "0.9rem" }}>
            Instantly scan your last 120 days of transactions for recurring charges.
          </p>
        </div>
        <Button variant="glass" size="sm" onClick={scan} disabled={loading}>
          {loading ? "🕵️ Scanning..." : "🕵️ Run Subscription Detective"}
        </Button>
      </div>

      {results && (
        <div className="detective-results animate-fade-in" style={{ marginTop: "1.25rem" }}>
          {results.length === 0 ? (
            <p className="no-results text-muted">No recurring subscriptions detected.</p>
          ) : (
            <div className="sub-list">
              {results.map((sub, i) => {
                const badge = formatConfidence(sub.confidence);
                const isAdded = addedNames.has(sub.name);
                return (
                  <div key={i} className="sub-item glass">
                    <div className="sub-main">
                      <span className="sub-name">{sub.name}</span>
                      <span className="sub-cost">${Number(sub.monthlyCost).toFixed(2)}/mo</span>
                    </div>
                    <div className="sub-reason">{sub.reason}</div>
                    <div className="sub-footer">
                      <span className={`sub-badge ${badge.level}`}>{badge.label}</span>
                      <Button
                        variant={isAdded ? "ghost" : "glass"}
                        size="sm"
                        disabled={addingIndex === i || isAdded}
                        onClick={() => handleAddCommitment(sub, i)}
                      >
                        {isAdded ? "✓ Tracked" : addingIndex === i ? "Adding..." : "➕ Track"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
