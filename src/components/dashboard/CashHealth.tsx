import Card from "@/components/ui/Card";

interface CashHealthProps {
  liquidCash: number;
  creditDebt: number;
  totalObligations: number;
  finalSurplus: number;
}

export default function CashHealth({ liquidCash, creditDebt, totalObligations, finalSurplus }: CashHealthProps) {
  const isHealthy = finalSurplus >= 0;

  return (
    <Card className={`cash-health-banner ${isHealthy ? 'healthy' : 'warning'}`}>
      <div className="banner-content">
        <div className="surplus-display">
          <span className="surplus-value">
            ${finalSurplus.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="surplus-label">Available to Budget</span>
        </div>
        
        <div className="banner-details">
          <div className="detail-item">
            <span className="label">Total Cash</span>
            <span className="value">${liquidCash.toLocaleString()}</span>
          </div>
          <div className="detail-operator">−</div>
          <div className="detail-item">
            <span className="label">Credit Debt</span>
            <span className="value">${creditDebt.toLocaleString()}</span>
          </div>
          <div className="detail-operator">−</div>
          <div className="detail-item">
            <span className="label">Category Obligations</span>
            <span className="value">${totalObligations.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .cash-health-banner {
          background: ${isHealthy ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)'};
          color: white;
          padding: 2.5rem;
          border: none;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .banner-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          text-align: center;
        }
        .surplus-display {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .surplus-value {
          font-size: 3.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .surplus-label {
          font-size: 0.9rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          opacity: 0.9;
        }
        .banner-details {
          display: flex;
          align-items: center;
          gap: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.2);
        }
        .detail-item {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .detail-item .label {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          opacity: 0.8;
        }
        .detail-item .value {
          font-size: 1.1rem;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }
        .detail-operator {
          font-size: 1.5rem;
          font-weight: 300;
          opacity: 0.6;
        }
      `}</style>
    </Card>
  );
}
