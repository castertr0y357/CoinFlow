"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";

interface PaycheckItem {
  date: string;
  amount: number;
  status: "received" | "pending";
}

interface ForecastProps {
  expectedIncome: number;
  projectedMonthEnd: number;
  isHealthy: boolean;
  paycheckEnabled?: boolean;
  paychecks?: PaycheckItem[];
  remainingIncome?: number;
  nextMonthAllocations?: number;
  nextMonthCommitments?: number;
  nextMonthSurplus?: number;
}

export default function ForecastCard({ 
  expectedIncome, 
  projectedMonthEnd, 
  isHealthy,
  paycheckEnabled = false,
  paychecks = [],
  remainingIncome = 0,
  nextMonthAllocations = 0,
  nextMonthCommitments = 0,
  nextMonthSurplus = 0
}: ForecastProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const formatDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <Card className={`forecast-card glass ${isHealthy ? 'healthy' : 'danger'}`} animate={true} delay="0.15s">
      <div className="forecast-header">
        <h3>Next-Month Funding</h3>
        <span className={`status-pill ${isHealthy ? 'pos' : 'neg'}`}>
          {isHealthy ? "Funded" : "Deficit"}
        </span>
      </div>
      
      {paycheckEnabled && paychecks.length > 0 && (
        /* Timeline of paychecks for current month */
        <div className="paycheck-timeline" style={{ marginBottom: '1.25rem' }}>
          <div className="timeline-title">Paycheck Schedule (Current Month)</div>
          <div className="timeline-list">
            {paychecks.map((p, idx) => (
              <div key={idx} className={`timeline-item ${p.status}`}>
                <div className="timeline-badge-container">
                  <div className={`timeline-node ${p.status}`}>
                    {p.status === "received" ? "✓" : "⏳"}
                  </div>
                  {idx < paychecks.length - 1 && <div className="timeline-line" />}
                </div>
                <div className="paycheck-details">
                  <div className="paycheck-info">
                    <span className="paycheck-date">{isMounted ? formatDate(p.date) : p.date}</span>
                    <span className={`paycheck-status-badge ${p.status}`}>
                      {p.status === "received" ? "Received" : "Pending"}
                    </span>
                  </div>
                  <span className="paycheck-amt">+${p.amount.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Airtight Math Breakdown */}
      <div className="forecast-math">
        <div className="math-row">
          <span className="label">Month-End Buffer</span>
          <span className="value">${projectedMonthEnd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
        </div>
        <div className="math-row">
          <span className="label">Next Month Budgets</span>
          <span className="value">-${nextMonthAllocations.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
        </div>
        <div className="math-row total">
          <span className="label">Projected Next-Month</span>
          <span className="value">
            {nextMonthSurplus < 0 ? "-" : ""}${Math.abs(nextMonthSurplus).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>
      
      <p className="forecast-hint text-xs text-muted mt-3">
        {isHealthy 
          ? "Your rolled-over buffer successfully funds next month's planned budget categories."
          : "Warning: Your next-month obligations exceed your rolled-over buffer fund."}
      </p>

      <style jsx>{`
        .forecast-card {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
        }
        .forecast-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
        }
        .status-pill {
          font-size: 0.65rem;
          font-weight: 800;
          padding: 0.25rem 0.6rem;
          border-radius: 100px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .status-pill.pos { background: rgba(16, 185, 129, 0.2); color: #10b981; }
        .status-pill.neg { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
        
        .forecast-math {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .math-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
        }
        .math-row .label {
          color: var(--text-muted);
        }
        .math-row .value {
          color: var(--text-main);
          font-weight: 600;
        }
        .math-row.total {
          margin-top: 0.25rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--glass-border);
          font-weight: 800;
          font-size: 1.2rem;
        }
        .math-row.total .value {
          color: var(--text-main);
        }
        .healthy .math-row.total .value { color: var(--accent); }
        .danger .math-row.total .value { color: var(--danger); }

        /* Paycheck Schedule Visuals */
        .paycheck-timeline {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 1rem;
        }
        .timeline-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
          margin-bottom: 0.75rem;
        }
        .timeline-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .timeline-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }
        .timeline-badge-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          height: 100%;
        }
        .timeline-node {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: bold;
          z-index: 2;
        }
        .timeline-node.received {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          border: 1.5px solid #10b981;
        }
        .timeline-node.pending {
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1.5px solid #f59e0b;
          animation: goldPulse 2s infinite ease-in-out;
        }
        .timeline-line {
          width: 2px;
          background: var(--glass-border);
          position: absolute;
          top: 22px;
          bottom: -12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1;
        }
        .paycheck-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex: 1;
          background: rgba(255, 255, 255, 0.01);
          border-radius: 8px;
          padding: 0.25rem 0.5rem;
          transition: background 0.2s ease;
        }
        .paycheck-details:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .paycheck-info {
          display: flex;
          flex-direction: column;
        }
        .paycheck-date {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-main);
        }
        .paycheck-status-badge {
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
          margin-top: 0.1rem;
        }
        .paycheck-status-badge.received {
          color: #10b981;
        }
        .paycheck-status-badge.pending {
          color: #f59e0b;
        }
        .paycheck-amt {
          font-size: 0.85rem;
          font-weight: 700;
        }
        .timeline-item.received .paycheck-amt {
          color: rgba(255, 255, 255, 0.8);
        }
        .timeline-item.pending .paycheck-amt {
          color: #f59e0b;
        }

        @keyframes goldPulse {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
      `}</style>
    </Card>
  );
}
