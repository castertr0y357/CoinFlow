"use client";

import Card from "@/components/ui/Card";

interface ForecastProps {
  expectedIncome: number;
  projectedMonthEnd: number;
  isHealthy: boolean;
}

export default function ForecastCard({ expectedIncome, projectedMonthEnd, isHealthy }: ForecastProps) {
  return (
    <Card className={`forecast-card glass ${isHealthy ? 'healthy' : 'danger'}`} animate={true} delay="0.15s">
      <div className="forecast-header">
        <h3>Month-End Forecast</h3>
        <span className={`status-pill ${isHealthy ? 'pos' : 'neg'}`}>
          {isHealthy ? "On Track" : "Low Funds"}
        </span>
      </div>
      
      <div className="forecast-math">
        <div className="math-row">
          <span className="label">Planned Income</span>
          <span className="value">+${expectedIncome.toLocaleString()}</span>
        </div>
        <div className="math-row total">
          <span className="label">Projected Cash</span>
          <span className="value">${projectedMonthEnd.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
        </div>
      </div>
      
      <p className="forecast-hint text-xs text-muted mt-3">
        {isHealthy 
          ? "Based on your expected income, you will end the month with a surplus."
          : "Warning: Your obligations exceed your projected cash flow for this month."}
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
          margin-bottom: 1.5rem;
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
        .math-row.total {
          margin-top: 0.5rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--glass-border);
          font-weight: 800;
          font-size: 1.25rem;
        }
        .math-row.total .value {
          color: var(--text-main);
        }
        .healthy .math-row.total .value { color: var(--accent); }
        .danger .math-row.total .value { color: var(--danger); }
      `}</style>
    </Card>
  );
}
