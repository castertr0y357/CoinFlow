import Card from "@/components/ui/Card";

interface TallyOverviewProps {
  savingsTarget: number;
  floatingSpending: number;
  currentTally: number;
}

export default function TallyOverview({ 
  savingsTarget, 
  floatingSpending, 
  currentTally 
}: TallyOverviewProps) {
  
  return (
    <Card className="tally-mini-card glass">
      <div className="mini-stat">
        <span className="label">Savings Target</span>
        <span className="value">${savingsTarget.toLocaleString()}</span>
      </div>
      <div className="mini-stat">
        <span className="label">Floating Spending</span>
        <span className="value text-danger">${floatingSpending.toLocaleString()}</span>
      </div>
      <div className="mini-stat">
        <span className="label">YTD +/- Net</span>
        <span className={`value ${currentTally >= 0 ? 'text-success' : 'text-danger'}`}>
          {currentTally >= 0 ? '+' : ''}${currentTally.toLocaleString()}
        </span>
      </div>

      <style jsx>{`
        .tally-mini-card {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 1.25rem;
          padding: 1.5rem 2rem;
        }
        .mini-stat {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .mini-stat .label {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          color: var(--text-muted);
          letter-spacing: 0.05em;
        }
        .mini-stat .value {
          font-size: 1.1rem;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }
        .text-success { color: #10b981; }
        .text-danger { color: #ef4444; }
      `}</style>
    </Card>
  );
}
