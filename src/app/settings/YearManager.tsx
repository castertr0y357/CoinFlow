"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { closeYearAndStartNext } from "./actions";

export default function YearManager({ currentYear }: { currentYear: number }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [nextYear, setNextYear] = useState<number | null>(null);

  const handleStartNextYear = async () => {
    if (!confirm(`Are you sure you want to finalize ${currentYear} and prepare the ${currentYear + 1} budget? This will calculate all rollovers automatically.`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const year = await closeYearAndStartNext();
      setNextYear(year);
      alert(`${year} Budget successfully initialized with rollovers from ${currentYear}!`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to close year");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="year-manager">
      <div className="current-year-status">
        <span className="label">Active Container:</span>
        <span className="value">{currentYear}</span>
      </div>
      
      <p className="text-muted text-sm mb-4">
        Closing the year will lock in your historical data and carry forward your surplus/deficits into a fresh {currentYear + 1} spreadsheet.
      </p>

      <Button 
        variant="glass" 
        onClick={handleStartNextYear} 
        disabled={isProcessing}
        className="w-full"
      >
        {isProcessing ? "Processing Year-End..." : `Start ${currentYear + 1} Budget`}
      </Button>

      {nextYear && (
        <p className="text-success text-sm mt-2">
          ✓ {nextYear} is ready for provisioning.
        </p>
      )}

      <style jsx>{`
        .year-manager {
          background: rgba(255, 255, 255, 0.02);
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid var(--glass-border);
        }
        .current-year-status {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          font-weight: 600;
        }
        .value {
          color: var(--primary);
        }
      `}</style>
    </div>
  );
}
