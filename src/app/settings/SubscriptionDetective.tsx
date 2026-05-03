"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

interface Subscription {
  name: string;
  monthlyCost: string;
  confidence: string;
  reason: string;
}

export default function SubscriptionDetective() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Subscription[] | null>(null);

  const scan = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/ai/subscriptions', {
        headers: { 'X-API-KEY': process.env.NEXT_PUBLIC_INTERNAL_API_KEY || '' }
      });
      const data = await res.json();
      setResults(data.subscriptions || []);
    } catch (error) {
      console.error("Scan error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="subscription-detective">
      <div className="detective-header">
        <p className="text-muted">Analyze your last 90 days for recurring ghosts.</p>
        <Button 
          variant="glass" 
          size="sm" 
          onClick={scan} 
          disabled={loading}
        >
          {loading ? "🕵️ Searching..." : "🕵️ Run Subscription Detective"}
        </Button>
      </div>

      {results && (
        <div className="detective-results animate-fade-in">
          {results.length === 0 ? (
            <p className="no-results">No recurring subscriptions detected.</p>
          ) : (
            <div className="sub-list">
              {results.map((sub, i) => (
                <div key={i} className="sub-item glass">
                  <div className="sub-main">
                    <span className="sub-name">{sub.name}</span>
                    <span className="sub-cost">${sub.monthlyCost}/mo</span>
                  </div>
                  <div className="sub-reason">{sub.reason}</div>
                  <div className={`sub-badge ${sub.confidence.toLowerCase()}`}>
                    {sub.confidence} Confidence
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
