"use client";

import { useState, useMemo, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import "./FireDrill.css";

interface CategoryTally {
  id: string;
  name: string;
  budget: number;
  provisions: number;
  rollover: number;
  spent: number; // average spending YTD per month
  remaining: number;
  tiedAccountId?: string | null;
  isOffBudget: boolean;
  isPaused: boolean;
  commitments: number; // monthly obligations
}

interface Account {
  id: string;
  name: string;
  displayName: string | null;
  balance: number;
  type: string;
  excludeFromSurplus: boolean;
  isDebt: boolean;
  showInSidebar: boolean;
  excludeFromAssetCalculation: boolean;
}

interface FireDrillClientProps {
  categories: CategoryTally[];
  accounts: Account[];
  initialForecast: {
    expectedIncome: number;
    nextMonthCommitments: number;
  };
}

export default function FireDrillClient({ categories, accounts, initialForecast }: FireDrillClientProps) {
  // 1. Sliders State
  const [incomeCut, setIncomeCut] = useState<number>(100); // 100% drop (complete job loss)
  const [discretionaryCut, setDiscretionaryCut] = useState<number>(50); // 50% cut in non-essentials

  // 2. Persistent selections states
  const [essentialIds, setEssentialIds] = useState<Set<string>>(new Set());
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [isMounted, setIsMounted] = useState<boolean>(false);
  
  // Toggling settings panel view (like Mortgage page Edit details)
  const [showAccountSettings, setShowAccountSettings] = useState<boolean>(false);

  // Load from localStorage on client mount to prevent SSR hydration mismatch
  useEffect(() => {
    setTimeout(() => {
      setIsMounted(true);
      
      // Load category selections
      const savedCategories = localStorage.getItem("coinflow_fire_drill_essential_ids");
      if (savedCategories) {
        try {
          setEssentialIds(new Set(JSON.parse(savedCategories)));
        } catch (e) {
          console.error("Failed to parse saved categories", e);
        }
      } else {
        // Clean start (do not default to anything)
        setEssentialIds(new Set());
      }

      // Load account selections
      const savedAccounts = localStorage.getItem("coinflow_fire_drill_liquid_account_ids");
      if (savedAccounts) {
        try {
          setSelectedAccountIds(new Set(JSON.parse(savedAccounts)));
        } catch (e) {
          console.error("Failed to parse saved accounts", e);
        }
      } else {
        // Default to accounts that are On Budget (excludeFromSurplus = false)
        const defaultIds = new Set<string>();
        accounts.forEach(a => {
          if (!a.excludeFromSurplus) {
            defaultIds.add(a.id);
          }
        });
        setSelectedAccountIds(defaultIds);
      }
    }, 0);
  }, [accounts]);

  const toggleEssential = (id: string) => {
    setEssentialIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("coinflow_fire_drill_essential_ids", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const toggleAccount = (id: string) => {
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("coinflow_fire_drill_liquid_account_ids", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // 3. Mathematical simulation calculations
  const expectedIncome = initialForecast?.expectedIncome || 5000;

  // Compute liquid cash dynamically based on selection
  const liquidCash = useMemo(() => {
    if (!isMounted) {
      // Before mount (SSR), fallback to sum of on-budget accounts
      return accounts.filter(a => !a.excludeFromSurplus).reduce((sum, a) => sum + a.balance, 0);
    }
    return accounts
      .filter(a => selectedAccountIds.has(a.id))
      .reduce((sum, a) => sum + a.balance, 0);
  }, [accounts, selectedAccountIds, isMounted]);

  const simulation = useMemo(() => {
    const essentialCategories = categories.filter(c => essentialIds.has(c.id));
    const discretionaryCategories = categories.filter(c => !essentialIds.has(c.id));

    // Survival Monthly Burn = commitments + base budget limits for essential items
    const survivalBurn = essentialCategories.reduce((sum, c) => {
      return sum + Math.max(c.budget, c.commitments);
    }, 0);

    // Discretionary Average Spend = YTD avg spent
    const discretionaryBase = discretionaryCategories.reduce((sum, c) => sum + c.spent, 0);

    // Crisis income
    const crisisIncome = expectedIncome * (1 - incomeCut / 100);

    // Crisis discretionary spending
    const crisisDiscretionary = discretionaryBase * (1 - discretionaryCut / 100);

    const totalCrisisBurn = survivalBurn + crisisDiscretionary;
    const netMonthlyDeficit = totalCrisisBurn - crisisIncome;

    const runwayMonths = netMonthlyDeficit > 0 ? (liquidCash / netMonthlyDeficit) : Infinity;

    // Build 12-month depletion schedule for projection
    const schedule: { month: number; date: Date; balance: number }[] = [];
    const today = new Date();
    
    // Month 0
    schedule.push({
      month: 0,
      date: new Date(today),
      balance: liquidCash
    });

    let currentBalance = liquidCash;
    for (let m = 1; m <= 12; m++) {
      const nextMonthDate = new Date(today);
      nextMonthDate.setMonth(today.getMonth() + m);
      
      currentBalance = Math.max(0, currentBalance - netMonthlyDeficit);
      schedule.push({
        month: m,
        date: nextMonthDate,
        balance: currentBalance
      });
    }

    return {
      survivalBurn,
      discretionaryBase,
      crisisIncome,
      crisisDiscretionary,
      totalCrisisBurn,
      netMonthlyDeficit,
      runwayMonths,
      schedule,
      discretionaryCategories
    };
  }, [categories, essentialIds, expectedIncome, incomeCut, discretionaryCut, liquidCash]);

  // 4. SVG Chart Scaling
  const chartWidth = 800;
  const chartHeight = 260;
  const paddingLeft = 70;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 40;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const points = useMemo(() => {
    return simulation.schedule.map(row => {
      const x = paddingLeft + (row.month / 12) * plotWidth;
      const y = chartHeight - paddingBottom - (row.balance / Math.max(1, liquidCash)) * plotHeight;
      return { x, y, row };
    });
  }, [simulation.schedule, liquidCash, plotWidth, plotHeight]);

  const chartPath = useMemo(() => {
    return points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  }, [points]);

  const chartArea = useMemo(() => {
    if (points.length === 0) return "";
    return `${chartPath} L ${points[points.length - 1].x} ${chartHeight - paddingBottom} L ${points[0].x} ${chartHeight - paddingBottom} Z`;
  }, [points, chartPath]);

  // Find exhaustion point (when balance hits 0)
  const exhaustionPoint = useMemo(() => {
    return points.find(p => p.row.balance === 0);
  }, [points]);

  const formatDateString = (date: Date) => {
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  };

  // Generate actionable items for discretionary categories
  const recommendations = useMemo(() => {
    if (simulation.netMonthlyDeficit <= 0) return [];
    
    // Sort discretionary categories by spent to target highest first
    const sortedDiscretionary = [...simulation.discretionaryCategories]
      .filter(c => c.spent > 0)
      .sort((a, b) => b.spent - a.spent);

    return sortedDiscretionary.slice(0, 3).map(c => {
      const newDeficit = simulation.netMonthlyDeficit - c.spent;
      let extraDays = 0;
      if (newDeficit > 0) {
        const newRunway = liquidCash / newDeficit;
        const diffMonths = newRunway - simulation.runwayMonths;
        extraDays = Math.round(diffMonths * 30);
      } else {
        extraDays = 999; // stops deficit
      }

      return {
        id: c.id,
        name: c.name,
        spent: c.spent,
        daysSaved: extraDays
      };
    });
  }, [simulation, liquidCash]);

  return (
    <div className="fire-drill-container">
      {/* Page Header with Settings trigger */}
      <header className="page-header-flex">
        <div>
          <h1>🚨 Financial Fire Drill</h1>
          <p className="text-dim">Simulate a financial crisis and audit your runway.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowAccountSettings(!showAccountSettings)}>
          {showAccountSettings ? "📊 Back to Simulation" : "⚙️ Configure Liquid Accounts"}
        </Button>
      </header>

      {/* Toggled Accounts Setup panel */}
      {showAccountSettings && isMounted && (
        <Card className="liquid-accounts-setup glass animate-fade-in">
          <div className="setup-card-header">
            <h3>Select Included Liquid Accounts</h3>
            <Button variant="primary" size="sm" onClick={() => setShowAccountSettings(false)}>Done</Button>
          </div>
          <p className="text-muted text-xs">Choose checking, savings, or investment assets factored into the liquid runway calculation.</p>
          
          <div className="account-checkboxes-grid">
            {accounts.map(acc => {
              const isChecked = selectedAccountIds.has(acc.id);
              return (
                <label 
                  key={acc.id} 
                  className={`account-checkbox-label ${isChecked ? 'selected' : ''}`}
                  onClick={() => toggleAccount(acc.id)}
                >
                  <div className="checkbox-info">
                    <input 
                      type="checkbox" 
                      checked={isChecked}
                      onChange={() => {}} // handled by click on label
                      style={{ cursor: 'pointer' }}
                    />
                    <span className="account-title">{acc.displayName || acc.name}</span>
                    {acc.excludeFromSurplus && (
                      <span className="badge off-budget-badge">Off-Budget</span>
                    )}
                  </div>
                  <span className="account-value font-mono">
                    ${Math.round(acc.balance).toLocaleString()}
                  </span>
                </label>
              );
            })}
          </div>
        </Card>
      )}

      {/* Simulation Metrics Panel */}
      <div className="fire-drill-stats-grid">
        <Card className="stat-card danger" animate={true}>
          <span className="stat-label">Total Liquid Capital</span>
          <div className="stat-value">${Math.round(liquidCash).toLocaleString()}</div>
          <span className="stat-sub">Selected Checking & Savings</span>
        </Card>
        
        <Card className="stat-card warning" animate={true} delay="0.1s">
          <span className="stat-label">Survival Runway</span>
          <div className="stat-value">
            {simulation.runwayMonths === Infinity 
              ? "Positive Cashflow" 
              : `${simulation.runwayMonths.toFixed(1)} Months`
            }
          </div>
          <span className="stat-sub">
            {simulation.runwayMonths === Infinity 
              ? "Your crisis income covers essential bills." 
              : `Depletion Date: ${formatDateString(simulation.schedule[simulation.schedule.length - 1].balance === 0 ? simulation.schedule.find(s => s.balance === 0)!.date : new Date(new Date().setMonth(new Date().getMonth() + 12)))}`
            }
          </span>
        </Card>

        <Card className="stat-card accent" animate={true} delay="0.2s">
          <span className="stat-label">Monthly Crisis Deficit</span>
          <div className="stat-value text-danger">
            ${Math.round(simulation.netMonthlyDeficit).toLocaleString()} / mo
          </div>
          <span className="stat-sub">Crisis Burn: ${Math.round(simulation.totalCrisisBurn).toLocaleString()}</span>
        </Card>
      </div>

      {/* SVG Runway Depletion Chart */}
      <Card className="chart-card glass" animate={true}>
        <div className="chart-header flex justify-between items-center">
          <div>
            <h3>Cash Depletion Runway</h3>
            <p className="text-dim text-xs">Projected liquid balance over the next 12 months under crisis</p>
          </div>
          <div className="chart-legend flex gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1"><span className="legend-dot av-dot"></span> Crisis Cash Balance</span>
          </div>
        </div>

        <div className="chart-wrapper mt-4">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="mortgage-svg">
            <defs>
              <linearGradient id="depletionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--danger)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--danger)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            <line x1={paddingLeft} y1={paddingTop} x2={chartWidth - paddingRight} y2={paddingTop} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
            <line x1={paddingLeft} y1={paddingTop + plotHeight / 2} x2={chartWidth - paddingRight} y2={paddingTop + plotHeight / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
            <line x1={paddingLeft} y1={chartHeight - paddingBottom} x2={chartWidth - paddingRight} y2={chartHeight - paddingBottom} stroke="rgba(255,255,255,0.1)" />

            {/* Chart Area Fill */}
            {chartArea && <path d={chartArea} fill="url(#depletionGradient)" />}

            {/* Path line */}
            {chartPath && <path d={chartPath} fill="none" stroke="var(--danger)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

            {/* Exhaustion Marker */}
            {exhaustionPoint && (
              <g>
                <line x1={exhaustionPoint.x} y1={paddingTop} x2={exhaustionPoint.x} y2={chartHeight - paddingBottom} stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="4 4" />
                <circle cx={exhaustionPoint.x} cy={exhaustionPoint.y} r="6" fill="var(--danger)" stroke="var(--bg-color)" strokeWidth="2" />
                <text x={exhaustionPoint.x} y={paddingTop - 8} textAnchor="middle" className="font-bold text-xs" fill="var(--danger)">CASH EXHAUSTED</text>
                <text x={exhaustionPoint.x} y={chartHeight - 12} textAnchor="middle" className="font-bold text-xxs" fill="var(--danger)">{formatDateString(exhaustionPoint.row.date)}</text>
              </g>
            )}

            {/* X axis labels */}
            {points.map((p, i) => (
              i % 3 === 0 && (
                <text key={i} x={p.x} y={chartHeight - 12} textAnchor="middle" className="axis-label" fill="var(--text-muted)">
                  {formatDateString(p.row.date)}
                </text>
              )
            ))}

            {/* Y axis labels */}
            <text x={paddingLeft - 10} y={paddingTop + 4} textAnchor="end" className="axis-label" fill="var(--text-muted)">
              ${(liquidCash / 1000).toFixed(0)}k
            </text>
            <text x={paddingLeft - 10} y={paddingTop + plotHeight / 2 + 4} textAnchor="end" className="axis-label" fill="var(--text-muted)">
              ${(liquidCash / 2 / 1000).toFixed(0)}k
            </text>
            <text x={paddingLeft - 10} y={chartHeight - paddingBottom + 4} textAnchor="end" className="axis-label" fill="var(--text-muted)">
              $0
            </text>
          </svg>
        </div>
      </Card>

      {/* Simulator Inputs & Recommendations */}
      <div className="fire-drill-split-grid">
        
        {/* Scenario Controls Card */}
        <Card className="fire-drill-controls glass">
          <h3>Crisis Scenario Parameters</h3>
          <p className="text-muted text-xs mb-6">Dial in your crisis situation to estimate impact.</p>

          <div className="calculator-ui">
            {/* Income Drop */}
            <div className="slider-group mb-6">
              <div className="slider-group-header">
                <label className="slider-title font-semibold text-sm">Income Reduction (Job Loss Impact)</label>
                <span className="font-mono text-danger font-bold">{incomeCut}% Drop</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="5" 
                value={incomeCut} 
                onChange={(e) => setIncomeCut(Number(e.target.value))}
                className="payment-slider"
              />
              <div className="slider-sub-labels">
                <span>Normal Income (${expectedIncome.toLocaleString()})</span>
                <span>No Income ($0)</span>
              </div>
            </div>

            {/* Discretionary Cuts */}
            <div className="slider-group">
              <div className="slider-group-header">
                <label className="slider-title font-semibold text-sm">Discretionary Spending Cutback</label>
                <span className="font-mono text-accent font-bold">{discretionaryCut}% Savings</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                step="5" 
                value={discretionaryCut} 
                onChange={(e) => setDiscretionaryCut(Number(e.target.value))}
                className="payment-slider"
              />
              <div className="slider-sub-labels">
                <span>Keep Spending Same</span>
                <span>Cut All Optional Spending</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Actionable Recommendations */}
        <Card className="fire-drill-recommendations glass">
          <h3>Runway Extension Actions</h3>
          <p className="text-muted text-xs mb-4">Eliminating these discretionary categories entirely stretches your runway.</p>

          <div className="recommendations-list">
            {recommendations.map(r => (
              <div key={r.id} className="rec-item glass p-3 mb-2 flex justify-between items-center">
                <div>
                  <span className="rec-name font-bold">{r.name}</span>
                  <div className="text-xxs text-dim mt-0.5">Average Spent: ${Math.round(r.spent)}/mo</div>
                </div>
                <div className="rec-benefit text-right">
                  <span className="days-label text-accent font-mono font-bold">
                    {r.daysSaved === 999 ? "Stops Deficit" : `+${r.daysSaved} Days Runway`}
                  </span>
                </div>
              </div>
            ))}
            {recommendations.length === 0 && (
              <p className="text-center text-muted text-xs">No discretionary categories have significant active spending.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Category Classification Table */}
      <Card className="categories-setup glass">
        <h3>Category Survival Classification</h3>
        <p className="text-dim text-xs mb-4">Toggling a category as Essential locks in its spending level. Discretionary categories are scaled down by your cutback slider.</p>
        
        <div className="fire-drill-table-wrapper">
          <table className="fire-drill-table">
            <thead>
              <tr>
                <th>Category Name</th>
                <th>Monthly Allocation</th>
                <th>Avg. Spent (YTD)</th>
                <th>Classification</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(c => {
                const isEssential = essentialIds.has(c.id);
                return (
                  <tr key={c.id} className={isEssential ? 'essential-row' : ''}>
                    <td className="font-semibold">{c.name}</td>
                    <td className="font-mono">${c.budget.toLocaleString()}</td>
                    <td className="font-mono text-dim">${c.spent.toLocaleString()}</td>
                    <td>
                      <Button 
                        variant={isEssential ? "primary" : "glass"} 
                        size="sm" 
                        onClick={() => toggleEssential(c.id)}
                      >
                        {isEssential ? "🚨 Essential" : "🌱 Discretionary"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
