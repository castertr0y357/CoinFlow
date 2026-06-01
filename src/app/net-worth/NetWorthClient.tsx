"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import Card from "@/components/ui/Card";
import { updateAccountExclusion, toggleAccountDebt } from "@/app/categories/actions";

interface NetWorthClientProps {
  initialData: {
    currentNetWorth: number;
    totalAssets: number;
    totalDebts: number;
    homeValue: number;
    history: { monthName: string; assets: number; debts: number; netWorth: number }[];
    accounts: {
      id: string;
      name: string;
      displayName?: string | null;
      balance: number;
      type: string;
      excludeFromSurplus: boolean;
      isDebt: boolean;
    }[];
  };
}

export default function NetWorthClient({ initialData }: NetWorthClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleToggleExclusion = async (id: string, current: boolean) => {
    startTransition(async () => {
      await updateAccountExclusion(id, !current);
      router.refresh();
      mutate("/api/v1/budget/tally");
    });
  };

  const handleToggleDebt = async (id: string, current: boolean) => {
    startTransition(async () => {
      await toggleAccountDebt(id, !current);
      router.refresh();
      mutate("/api/v1/budget/tally");
    });
  };

  // Group accounts
  const assets = initialData.accounts.filter(a => !a.isDebt);
  const debts = initialData.accounts.filter(a => a.isDebt);

  // SVG Chart Math
  const history = initialData.history;
  const values = history.map(h => h.netWorth);
  
  const minVal = Math.min(...values, 0); // Include 0
  const maxVal = Math.max(...values, 1000); // Standard ceiling
  const range = maxVal - minVal || 1;

  const width = 800;
  const height = 260;
  const paddingLeft = 70;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = history.map((h, i) => {
    const x = paddingLeft + (i / (history.length - 1)) * chartWidth;
    const y = height - paddingBottom - ((h.netWorth - minVal) / range) * chartHeight;
    return { x, y, label: h.monthName, val: h.netWorth, assets: h.assets, debts: h.debts };
  });

  const linePath = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  const areaPath = `M ${points[0].x} ${height - paddingBottom} ` + points.map(p => `L ${p.x} ${p.y}`).join(" ") + ` L ${points[points.length - 1].x} ${height - paddingBottom} Z`;
  
  // Calculate zero-line if range spans both positive and negative values
  const zeroY = height - paddingBottom - ((0 - minVal) / range) * chartHeight;

  return (
    <div className={`net-worth-client-content ${isPending ? "pending" : ""}`}>
      {/* 1. Summary Cards */}
      <div className="net-worth-grid">
        <Card className="summary-card wealth-card glass highlight">
          <div className="card-inner">
            <span className="card-label">Total Net Worth</span>
            <h2 className="card-value">
              ${initialData.currentNetWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <span className="card-subtitle">Aggregated assets and debts</span>
          </div>
        </Card>

        <Card className="summary-card wealth-card glass">
          <div className="card-inner">
            <span className="card-label">Total Assets</span>
            <h2 className="card-value text-success">
              ${initialData.totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <span className="card-subtitle">Cash, savings, & home equity</span>
          </div>
        </Card>

        <Card className="summary-card wealth-card glass">
          <div className="card-inner">
            <span className="card-label">Total Debts</span>
            <h2 className="card-value text-danger">
              ${initialData.totalDebts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            <span className="card-subtitle">Credit cards, loans, & mortgages</span>
          </div>
        </Card>
      </div>

      {/* 2. Visual Net Worth Trend Chart */}
      <Card className="chart-card glass mt-8" animate={true}>
        <h3>Net Worth History</h3>
        <p className="text-dim text-xs mb-6">Historical net worth over the last 6 months</p>

        <div className="chart-wrapper">
          <svg viewBox={`0 0 ${width} ${height}`} className="net-worth-svg">
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
            <line x1={paddingLeft} y1={paddingTop + chartHeight / 2} x2={width - paddingRight} y2={paddingTop + chartHeight / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
            <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="rgba(255,255,255,0.05)" />

            {/* Zero Line */}
            {minVal < 0 && (
              <line x1={paddingLeft} y1={zeroY} x2={width - paddingRight} y2={zeroY} stroke="rgba(239, 68, 68, 0.3)" strokeWidth="1" strokeDasharray="2" />
            )}

            {/* Area under the line */}
            <path d={areaPath} fill="url(#chartGradient)" />

            {/* The main stroke line */}
            <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

            {/* Chart Nodes */}
            {points.map((p, i) => (
              <g key={i} className="chart-node">
                <circle cx={p.x} cy={p.y} r="5" fill="var(--primary)" stroke="var(--bg-color)" strokeWidth="2" />
                
                {/* Net Worth label */}
                <text x={p.x} y={p.y - 14} textAnchor="middle" className="node-value">
                  ${p.val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </text>
                
                {/* Month Label */}
                <text x={p.x} y={height - 12} textAnchor="middle" className="axis-label">
                  {p.label}
                </text>
              </g>
            ))}

            {/* Y Axis Labels */}
            <text x={paddingLeft - 10} y={paddingTop + 4} textAnchor="end" className="axis-label">
              ${maxVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
            <text x={paddingLeft - 10} y={paddingTop + chartHeight / 2 + 4} textAnchor="end" className="axis-label">
              ${((maxVal + minVal) / 2).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
            <text x={paddingLeft - 10} y={height - paddingBottom + 4} textAnchor="end" className="axis-label">
              ${minVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
          </svg>
        </div>
      </Card>

      {/* 3. Account Breakdown lists */}
      <div className="breakdown-grid mt-8">
        {/* Assets Section */}
        <Card className="breakdown-card glass">
          <div className="breakdown-header">
            <h3>Asset Allocation</h3>
            <span className="badge assets-badge">Assets</span>
          </div>

          <div className="breakdown-list">
            {assets.map(acc => (
              <div key={acc.id} className="breakdown-item">
                <div className="account-details">
                  <div className="account-actions">
                    <button 
                      className={`control-btn ${acc.excludeFromSurplus ? 'excluded' : 'included'}`}
                      onClick={() => handleToggleExclusion(acc.id, acc.excludeFromSurplus)}
                      title={acc.excludeFromSurplus ? "Currently Excluded from Dashboard Surplus (Off-Budget). Click to include." : "Included in Dashboard Surplus (On-Budget). Click to exclude."}
                    >
                      {acc.excludeFromSurplus ? '⊘' : '✓'}
                    </button>
                    <button 
                      className={`control-btn debt-toggle-btn ${acc.isDebt ? 'active-debt' : ''}`}
                      onClick={() => handleToggleDebt(acc.id, acc.isDebt)}
                      title="Toggle Asset/Debt Type"
                    >
                      D
                    </button>
                  </div>
                  <div className="account-name-group">
                    <span className="acc-name">{acc.displayName || acc.name}</span>
                    <span className="acc-type">{acc.type}</span>
                  </div>
                </div>
                <span className="acc-balance text-success">
                  ${acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            ))}

            {initialData.homeValue > 0 && (
              <div className="breakdown-item property-item">
                <div className="account-details">
                  <div className="account-actions">
                    <span className="static-indicator">🏠</span>
                  </div>
                  <div className="account-name-group">
                    <span className="acc-name">Home Valuation / Equity</span>
                    <span className="acc-type">Real Estate Asset</span>
                  </div>
                </div>
                <span className="acc-balance text-success">
                  ${initialData.homeValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Debts Section */}
        <Card className="breakdown-card glass">
          <div className="breakdown-header">
            <h3>Debt Allocation</h3>
            <span className="badge debts-badge">Debts</span>
          </div>

          <div className="breakdown-list">
            {debts.length === 0 ? (
              <div className="empty-breakdown text-dim text-center py-8">No debt accounts registered.</div>
            ) : (
              debts.map(acc => (
                <div key={acc.id} className="breakdown-item">
                  <div className="account-details">
                    <div className="account-actions">
                      <button 
                        className={`control-btn ${acc.excludeFromSurplus ? 'excluded' : 'included'}`}
                        onClick={() => handleToggleExclusion(acc.id, acc.excludeFromSurplus)}
                        title={acc.excludeFromSurplus ? "Currently Excluded from Dashboard Surplus. Click to include." : "Included in Dashboard Surplus. Click to exclude."}
                      >
                        {acc.excludeFromSurplus ? '⊘' : '✓'}
                      </button>
                      <button 
                        className={`control-btn debt-toggle-btn ${acc.isDebt ? 'active-debt' : ''}`}
                        onClick={() => handleToggleDebt(acc.id, acc.isDebt)}
                        title="Toggle Asset/Debt Type"
                      >
                        D
                      </button>
                    </div>
                    <div className="account-name-group">
                      <span className="acc-name">{acc.displayName || acc.name}</span>
                      <span className="acc-type">{acc.type}</span>
                    </div>
                  </div>
                  <span className="acc-balance text-danger">
                    ${Math.abs(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
