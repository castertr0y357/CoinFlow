"use client";

import { useState, useMemo, useEffect } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { simulatePayoff, Debt, DebtPayoffSummary, DebtPayoffSimRow } from "@/lib/debtUtils";
import { saveDebtDetailAction } from "./actions";
import "./Debts.css";

interface LiquidAsset {
  id: string;
  name: string;
  balance: number;
  type: string;
  excludeFromSurplus: boolean;
}

interface DebtWithExtra extends Debt {
  excludeFromSurplus: boolean;
}

interface DebtsClientProps {
  initialDebts: DebtWithExtra[];
  liquidAssets: LiquidAsset[];
}

export default function DebtsClient({ initialDebts, liquidAssets }: DebtsClientProps) {
  const [debts, setDebts] = useState<DebtWithExtra[]>(initialDebts);
  const [extraMonthly, setExtraMonthly] = useState<number>(100);
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editInterest, setEditInterest] = useState<string>("");
  const [editMinPayment, setEditMinPayment] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Interest Leak settings
  const [emergencyBuffer, setEmergencyBuffer] = useState<number>(3000);

  // States for hovering the graph
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Account Settings Drawer states
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [selectedDebtIds, setSelectedDebtIds] = useState<Set<string>>(new Set());
  const [selectedLiquidIds, setSelectedLiquidIds] = useState<Set<string>>(new Set());
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // Load from localStorage on client mount to prevent SSR hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    
    // Load selected debt accounts
    const savedDebts = localStorage.getItem("coinflow_debts_selected_account_ids");
    if (savedDebts) {
      try {
        setSelectedDebtIds(new Set(JSON.parse(savedDebts)));
      } catch (e) {
        console.error("Failed to parse saved debts", e);
      }
    } else {
      // Smart default: Select all debts that have balance > 0 and excludeFromSurplus is false
      const defaultIds = new Set<string>();
      initialDebts.forEach(d => {
        if (d.balance > 0 && !d.excludeFromSurplus) {
          defaultIds.add(d.id);
        }
      });
      setSelectedDebtIds(defaultIds);
    }

    // Load selected liquid asset accounts
    const savedAssets = localStorage.getItem("coinflow_debts_selected_liquid_ids");
    if (savedAssets) {
      try {
        setSelectedLiquidIds(new Set(JSON.parse(savedAssets)));
      } catch (e) {
        console.error("Failed to parse saved liquid assets", e);
      }
    } else {
      // Smart default: Select checking/savings that are On Budget
      const defaultIds = new Set<string>();
      liquidAssets.forEach(acc => {
        if (!acc.excludeFromSurplus) {
          defaultIds.add(acc.id);
        }
      });
      setSelectedLiquidIds(defaultIds);
    }
  }, [initialDebts, liquidAssets]);

  const toggleDebtSelection = (id: string) => {
    setSelectedDebtIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("coinflow_debts_selected_account_ids", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const toggleLiquidSelection = (id: string) => {
    setSelectedLiquidIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem("coinflow_debts_selected_liquid_ids", JSON.stringify(Array.from(next)));
      return next;
    });
  };

  // Filter debts used in simulation to only those that are selected (and have a balance > 0)
  const activeDebts = useMemo(() => {
    if (!isMounted) {
      // Fallback for SSR
      return debts.filter(d => !d.excludeFromSurplus && d.balance > 0);
    }
    return debts.filter(d => selectedDebtIds.has(d.id) && d.balance > 0);
  }, [debts, selectedDebtIds, isMounted]);

  // Calculate simulations using active (selected) debts
  const { avalanche, snowball, minimums } = useMemo(() => {
    const startDate = new Date();
    
    const avalancheSim = simulatePayoff(activeDebts, extraMonthly, 'avalanche', startDate);
    const snowballSim = simulatePayoff(activeDebts, extraMonthly, 'snowball', startDate);
    const minimumsSim = simulatePayoff(activeDebts, 0, 'minimums', startDate);

    return {
      avalanche: avalancheSim,
      snowball: snowballSim,
      minimums: minimumsSim
    };
  }, [activeDebts, extraMonthly]);

  // Max payoff months across all strategies to standardise X-axis scaling
  const maxSimMonths = useMemo(() => {
    const months = Math.max(
      avalanche.schedule.length,
      snowball.schedule.length,
      minimums.schedule.length
    );
    return Math.max(1, months - 1);
  }, [avalanche, snowball, minimums]);

  // Max total balance at month 0 to scale Y-axis
  const maxTotalBalance = useMemo(() => {
    const balance = Math.max(
      avalanche.schedule[0]?.totalBalance || 1000,
      snowball.schedule[0]?.totalBalance || 1000,
      minimums.schedule[0]?.totalBalance || 1000
    );
    return balance > 0 ? balance : 1000;
  }, [avalanche, snowball, minimums]);

  // SVG dimensions
  const chartWidth = 800;
  const chartHeight = 280;
  const paddingLeft = 70;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 40;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  // Convert schedules into SVG coordinates
  const scalePoints = (schedule: DebtPayoffSimRow[]) => {
    if (schedule.length === 0) return [];
    return schedule.map((row) => {
      // Scale X based on the longest schedule (maxSimMonths) to align points temporally
      const x = paddingLeft + (row.month / maxSimMonths) * plotWidth;
      const y = chartHeight - paddingBottom - (row.totalBalance / maxTotalBalance) * plotHeight;
      return { x, y, row };
    });
  };

  const avalanchePoints = useMemo(() => scalePoints(avalanche.schedule), [avalanche, maxSimMonths, maxTotalBalance]);
  const snowballPoints = useMemo(() => scalePoints(snowball.schedule), [snowball, maxSimMonths, maxTotalBalance]);
  const minimumsPoints = useMemo(() => scalePoints(minimums.schedule), [minimums, maxSimMonths, maxTotalBalance]);

  const getPath = (points: { x: number, y: number }[]) => {
    return points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  };

  const getAreaPath = (points: { x: number, y: number }[], pathStr: string) => {
    if (points.length === 0) return "";
    return `${pathStr} L ${points[points.length - 1].x} ${chartHeight - paddingBottom} L ${points[0].x} ${chartHeight - paddingBottom} Z`;
  };

  const avalanchePath = useMemo(() => getPath(avalanchePoints), [avalanchePoints]);
  const snowballPath = useMemo(() => getPath(snowballPoints), [snowballPoints]);
  const minimumsPath = useMemo(() => getPath(minimumsPoints), [minimumsPoints]);

  const avalancheArea = useMemo(() => getAreaPath(avalanchePoints, avalanchePath), [avalanchePoints, avalanchePath]);
  const snowballArea = useMemo(() => getAreaPath(snowballPoints, snowballPath), [snowballPoints, snowballPath]);

  // Hover state processing
  const hoveredRow = useMemo(() => {
    if (hoveredIndex === null) return null;
    
    // We map the hoveredIndex based on minimums schedule (which is usually the longest)
    // Find closest index for each strategy
    const getClosestRow = (points: typeof avalanchePoints, index: number) => {
      if (points.length === 0) return null;
      // Map index proportionally
      const ratio = index / maxSimMonths;
      const actualIndex = Math.min(points.length - 1, Math.round(ratio * (points.length - 1)));
      return points[actualIndex];
    };

    const stdPoint = getClosestRow(minimumsPoints, hoveredIndex);
    const avPoint = getClosestRow(avalanchePoints, hoveredIndex);
    const snPoint = getClosestRow(snowballPoints, hoveredIndex);

    return {
      date: stdPoint?.row.date || new Date(),
      minimumsBalance: stdPoint?.row.totalBalance ?? 0,
      avalancheBalance: avPoint?.row.totalBalance ?? 0,
      snowballBalance: snPoint?.row.totalBalance ?? 0,
      x: paddingLeft + (hoveredIndex / maxSimMonths) * plotWidth
    };
  }, [hoveredIndex, avalanchePoints, snowballPoints, minimumsPoints, maxSimMonths]);

  // Tick marks for years on the X axis
  const yearTicks = useMemo(() => {
    const ticks: { x: number; label: string }[] = [];
    const schedule = minimums.schedule;
    if (schedule.length === 0) return [];
    
    let lastTickYear = -1;
    const totalMonths = schedule.length;
    const intervalYears = Math.max(1, Math.floor(totalMonths / 12 / 5));

    for (let i = 0; i < totalMonths; i++) {
      const row = schedule[i];
      const y = row.date.getUTCFullYear();
      if (y !== lastTickYear && (ticks.length === 0 || y - lastTickYear >= intervalYears)) {
        const x = paddingLeft + (row.month / maxSimMonths) * plotWidth;
        ticks.push({ x, label: String(y) });
        lastTickYear = y;
      }
    }
    return ticks;
  }, [minimums, maxSimMonths]);

  // Interest Leak calculations
  const totalLiquidCash = useMemo(() => {
    if (!isMounted) {
      return liquidAssets.filter(acc => !acc.excludeFromSurplus).reduce((sum, acc) => sum + acc.balance, 0);
    }
    return liquidAssets.filter(acc => selectedLiquidIds.has(acc.id)).reduce((sum, acc) => sum + acc.balance, 0);
  }, [liquidAssets, selectedLiquidIds, isMounted]);

  const excessCash = useMemo(() => {
    return Math.max(0, totalLiquidCash - emergencyBuffer);
  }, [totalLiquidCash, emergencyBuffer]);

  // Find the highest interest rate debt that is currently active (balance > 0)
  const highestAprDebt = useMemo(() => {
    const active = activeDebts.filter(d => d.balance > 0);
    if (active.length === 0) return null;
    return [...active].sort((a, b) => b.interestRate - a.interestRate)[0];
  }, [activeDebts]);

  // Daily interest leak calculation
  const totalDailyInterestLeak = useMemo(() => {
    return activeDebts.reduce((sum, d) => {
      const dailyRate = d.interestRate / 100 / 365;
      return sum + (d.balance * dailyRate);
    }, 0);
  }, [activeDebts]);

  const handleEditClick = (debt: Debt) => {
    setEditingDebtId(debt.id);
    setEditInterest(String(debt.interestRate));
    setEditMinPayment(String(debt.minimumPayment));
  };

  const handleSaveClick = async (id: string) => {
    setIsSaving(true);
    try {
      const rate = Number(editInterest);
      const min = Number(editMinPayment);
      if (isNaN(rate) || isNaN(min)) {
        alert("Please enter valid numbers");
        return;
      }
      const res = await saveDebtDetailAction(id, rate, min);
      if (res.success) {
        setDebts(prev => prev.map(d => d.id === id ? { ...d, interestRate: rate, minimumPayment: min } : d));
        setEditingDebtId(null);
      }
    } catch (e) {
      console.error(e);
      alert("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  // Next-month payment checklist for Avalanche (recommended strategy)
  const nextMonthChecklist = useMemo(() => {
    const active = debts.filter(d => d.balance > 0);
    if (active.length === 0) return [];
    
    // Sort by interest rate for avalanche target
    const targetSorted = [...active].sort((a, b) => b.interestRate - a.interestRate);
    const targetId = targetSorted[0]?.id;

    const initialMinPaymentsSum = active.reduce((sum, d) => sum + d.minimumPayment, 0);
    const totalBudget = initialMinPaymentsSum + extraMonthly;

    let remainingBudget = totalBudget;
    const allocations: Record<string, number> = {};

    // A. Minimums
    active.forEach(d => {
      const amt = Math.min(d.minimumPayment, d.balance);
      allocations[d.id] = amt;
      remainingBudget -= amt;
    });

    // B. Add extra to target
    if (remainingBudget > 0 && targetId) {
      const remainingBalance = debts.find(d => d.id === targetId)!.balance - allocations[targetId];
      const extraToAdd = Math.min(remainingBudget, Math.max(0, remainingBalance));
      allocations[targetId] = (allocations[targetId] || 0) + extraToAdd;
    }

    return active.map(d => ({
      id: d.id,
      name: d.name,
      total: d.balance,
      interestRate: d.interestRate,
      minimum: d.minimumPayment,
      recommended: allocations[d.id] || 0,
      isTarget: d.id === targetId
    }));
  }, [debts, extraMonthly]);

  const formatDateString = (date: Date) => {
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  };

  return (
    <div className="debts-container">
      {/* Page Header with Settings trigger */}
      <header className="page-header-flex">
        <div>
          <h1 className="animate-fade-in">Debt Payoff Command Center</h1>
          <p className="text-dim animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Simulate payoff timelines, compare Avalanche vs. Snowball, and optimize extra payments.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
          {showSettings ? "📊 Back to Simulation" : "⚙️ Configure Optimizer Accounts"}
        </Button>
      </header>

      {/* Toggled Settings Card */}
      {showSettings && isMounted && (
        <Card className="debts-accounts-setup glass animate-fade-in mb-6">
          <div className="setup-card-header mb-2">
            <h3>Configure Optimizer Accounts</h3>
            <Button variant="primary" size="sm" onClick={() => setShowSettings(false)}>Done</Button>
          </div>
          <p className="text-muted text-xs mb-4">Select which accounts to include in the simulation and interest leak buffer audit, and configure their parameters.</p>
          
          <div className="settings-columns-grid">
            {/* Left Column: Debt Inclusions and Settings */}
            <div className="settings-column">
              <h4>Include Debts in Simulation</h4>
              <p className="text-muted text-xxs mb-3">Toggling checkboxes includes/excludes them from calculations. Edit interest rates/minimums below.</p>
              
              <div className="debts-table-wrapper">
                <table className="debts-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Include</th>
                      <th>Account</th>
                      <th>Balance</th>
                      <th>APR (%)</th>
                      <th>Min. Payment</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debts.map(d => {
                      const isChecked = selectedDebtIds.has(d.id);
                      return (
                        <tr key={d.id} className={isChecked ? 'selected-row' : ''}>
                          <td style={{ textAlign: 'center' }}>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleDebtSelection(d.id)}
                              style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                            />
                          </td>
                          <td className="font-semibold">{d.name}</td>
                          <td className="font-mono text-danger">${d.balance.toLocaleString(undefined, { minimumFractionDigits: 0 })}</td>
                          <td>
                            {editingDebtId === d.id ? (
                              <input 
                                type="number" 
                                step="0.01" 
                                value={editInterest} 
                                onChange={(e) => setEditInterest(e.target.value)} 
                                className="table-input"
                              />
                            ) : (
                              <span className="font-mono">{d.interestRate > 0 ? `${d.interestRate}%` : "—"}</span>
                            )}
                          </td>
                          <td>
                            {editingDebtId === d.id ? (
                              <input 
                                type="number" 
                                value={editMinPayment} 
                                onChange={(e) => setEditMinPayment(e.target.value)} 
                                className="table-input"
                              />
                            ) : (
                              <span className="font-mono">{d.minimumPayment > 0 ? `$${d.minimumPayment}` : "—"}</span>
                            )}
                          </td>
                          <td>
                            {editingDebtId === d.id ? (
                              <div className="flex gap-2">
                                <Button variant="primary" size="sm" onClick={() => handleSaveClick(d.id)} disabled={isSaving}>
                                  {isSaving ? "..." : "Save"}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setEditingDebtId(null)}>
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button variant="glass" size="sm" onClick={() => handleEditClick(d)}>
                                ✍️ Edit
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {debts.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted">No debt accounts found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Liquid Cash Inclusions */}
            <div className="settings-column">
              <h4>Include Liquid Cash Assets</h4>
              <p className="text-muted text-xxs mb-3">Choose checking, savings, or investment assets factored into the interest leakage warning calculations.</p>
              
              <div className="account-checkboxes-grid">
                {liquidAssets.map(acc => {
                  const isChecked = selectedLiquidIds.has(acc.id);
                  return (
                    <label 
                      key={acc.id} 
                      className={`account-checkbox-label ${isChecked ? 'selected' : ''}`}
                      onClick={() => toggleLiquidSelection(acc.id)}
                    >
                      <div className="checkbox-info">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => {}} // handled by label click
                          style={{ cursor: 'pointer' }}
                        />
                        <span className="account-title">{acc.name}</span>
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
                {liquidAssets.length === 0 && (
                  <p className="text-center text-muted text-xs">No asset accounts found.</p>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeDebts.length === 0 ? (
        <Card className="glass text-center p-8 mt-6">
          <p className="text-muted">No active debts selected for payoff simulation.</p>
          <p className="text-dim text-xs mt-2">Click <strong>⚙️ Configure Optimizer Accounts</strong> in the header to select which debts to track.</p>
        </Card>
      ) : (
        <>
          {/* 2. Interactive Optimizer Controls & Strategy Comparison */}
          <div className="debts-optimizer-grid mb-6">
            <Card className="payoff-controls glass">
              <h3>2. Set Payoff Budget</h3>
              <p className="text-muted text-xs mb-6">Allocate extra cash on top of your minimums to accelerate payoff.</p>
              
              <div className="calculator-ui">
                <div className="slider-group mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <label className="slider-title font-semibold text-sm">Extra Monthly Payment</label>
                    <div className="flex items-center gap-1">
                      <span className="text-accent font-semibold text-sm">$</span>
                      <input 
                        type="number" 
                        min="0" 
                        value={extraMonthly} 
                        onChange={(e) => setExtraMonthly(Math.max(0, Number(e.target.value)))} 
                        className="manual-extra-input"
                      />
                      <span className="text-muted text-xs">/ mo</span>
                    </div>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="2000" 
                    step="25" 
                    value={Math.min(extraMonthly, 2000)} 
                    onChange={(e) => setExtraMonthly(Number(e.target.value))}
                    className="payment-slider"
                  />
                </div>
                
                <div className="total-budget-indicator glass p-3 mt-4">
                  <div className="flex justify-between text-xs mb-1">
                    <span>Sum of Minimum Payments:</span>
                    <span className="font-mono">${activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Total Monthly Debt Budget:</span>
                    <span className="font-mono text-accent">${(activeDebts.reduce((sum, d) => sum + d.minimumPayment, 0) + extraMonthly).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </Card>

        {/* Strategy Comparison */}
        <Card className="strategy-comparison glass">
          <h3>Payoff Milestones</h3>
          <p className="text-dim text-xxs mb-4">Compare key indicators across payoff methods.</p>
          
          <div className="strategy-cards-container">
            <div className="strat-card avalanche-card">
              <div className="strat-header">
                <span className="strat-badge avalanche">AVALANCHE (RECOMMENDED)</span>
                <h4>{avalanche.payoffMonths < 600 ? formatDateString(avalanche.payoffDate) : "Deadlock"}</h4>
              </div>
              <div className="strat-stats">
                <div>
                  <span className="lbl">Timeline</span>
                  <span className="val">{avalanche.payoffMonths} months</span>
                </div>
                <div>
                  <span className="lbl">Interest Cost</span>
                  <span className="val text-danger">${Math.round(avalanche.totalInterest).toLocaleString()}</span>
                </div>
              </div>
              <div className="strat-savings font-bold">
                Saved: ${Math.round(minimums.totalInterest - avalanche.totalInterest).toLocaleString()} & {minimums.payoffMonths - avalanche.payoffMonths} months
              </div>
            </div>

            <div className="strat-card snowball-card">
              <div className="strat-header">
                <span className="strat-badge snowball">SNOWBALL</span>
                <h4>{snowball.payoffMonths < 600 ? formatDateString(snowball.payoffDate) : "Deadlock"}</h4>
              </div>
              <div className="strat-stats">
                <div>
                  <span className="lbl">Timeline</span>
                  <span className="val">{snowball.payoffMonths} months</span>
                </div>
                <div>
                  <span className="lbl">Interest Cost</span>
                  <span className="val text-danger">${Math.round(snowball.totalInterest).toLocaleString()}</span>
                </div>
              </div>
              <div className="strat-savings font-bold">
                Saved: ${Math.round(minimums.totalInterest - snowball.totalInterest).toLocaleString()} & {minimums.payoffMonths - snowball.payoffMonths} months
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Trajectory SVG Chart */}
      <Card className="chart-card glass mb-6" animate={true}>
        <div className="chart-header flex justify-between items-center">
          <div>
            <h3>Payoff Trajectories</h3>
            <p className="text-dim text-xs">Total remaining liability balance over time</p>
          </div>
          <div className="chart-legend flex gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="legend-dot min-dot"></span> Minimum Payments</span>
            <span className="flex items-center gap-1"><span className="legend-dot sn-dot"></span> Debt Snowball</span>
            <span className="flex items-center gap-1"><span className="legend-dot av-dot"></span> Debt Avalanche</span>
          </div>
        </div>

        <div className="chart-wrapper mt-4">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="mortgage-svg">
            <defs>
              <linearGradient id="avGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="snGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            <line x1={paddingLeft} y1={paddingTop} x2={chartWidth - paddingRight} y2={paddingTop} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
            <line x1={paddingLeft} y1={paddingTop + plotHeight / 2} x2={chartWidth - paddingRight} y2={paddingTop + plotHeight / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
            <line x1={paddingLeft} y1={chartHeight - paddingBottom} x2={chartWidth - paddingRight} y2={chartHeight - paddingBottom} stroke="rgba(255,255,255,0.1)" />

            {/* Fills */}
            {avalancheArea && <path d={avalancheArea} fill="url(#avGradient)" />}
            {snowballArea && <path d={snowballArea} fill="url(#snGradient)" />}

            {/* Trajectory Lines */}
            {minimumsPath && <path d={minimumsPath} fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="5 5" />}
            {snowballPath && <path d={snowballPath} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            {avalanchePath && <path d={avalanchePath} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

            {/* End Dots */}
            {avalanchePoints.length > 0 && (
              <circle cx={avalanchePoints[avalanchePoints.length - 1].x} cy={avalanchePoints[avalanchePoints.length - 1].y} r="5" fill="var(--primary)" />
            )}
            {snowballPoints.length > 0 && (
              <circle cx={snowballPoints[snowballPoints.length - 1].x} cy={snowballPoints[snowballPoints.length - 1].y} r="4" fill="var(--accent)" />
            )}

            {/* X Axis Labels */}
            {yearTicks.map((tick, i) => (
              <text key={i} x={tick.x} y={chartHeight - 12} textAnchor="middle" className="axis-label" fill="var(--text-muted)">
                {tick.label}
              </text>
            ))}

            {/* Y Axis Labels */}
            <text x={paddingLeft - 10} y={paddingTop + 4} textAnchor="end" className="axis-label" fill="var(--text-muted)">
              ${(maxTotalBalance / 1000).toFixed(0)}k
            </text>
            <text x={paddingLeft - 10} y={paddingTop + plotHeight / 2 + 4} textAnchor="end" className="axis-label" fill="var(--text-muted)">
              ${(maxTotalBalance / 2 / 1000).toFixed(0)}k
            </text>
            <text x={paddingLeft - 10} y={chartHeight - paddingBottom + 4} textAnchor="end" className="axis-label" fill="var(--text-muted)">
              $0
            </text>

            {/* Hover Tracker */}
            {hoveredRow && (
              <g>
                <line 
                  x1={hoveredRow.x} 
                  y1={paddingTop} 
                  x2={hoveredRow.x} 
                  y2={chartHeight - paddingBottom} 
                  stroke="rgba(255, 255, 255, 0.15)" 
                  strokeWidth="1" 
                  strokeDasharray="2 2" 
                />
                
                {/* Tooltip Box */}
                <rect
                  x={hoveredRow.x + 10 + 140 > chartWidth - paddingRight ? hoveredRow.x - 150 : hoveredRow.x + 10}
                  y={paddingTop + 10}
                  width="140"
                  height="90"
                  rx="8"
                  fill="rgba(13, 14, 18, 0.95)"
                  stroke="var(--glass-border)"
                  strokeWidth="1.5"
                />
                <g transform={`translate(${hoveredRow.x + 10 + 140 > chartWidth - paddingRight ? hoveredRow.x - 140 : hoveredRow.x + 20}, ${paddingTop + 28})`}>
                  <text className="tooltip-date font-bold text-xs" fill="white">
                    {formatDateString(hoveredRow.date)}
                  </text>
                  <text y="20" className="tooltip-value text-xxs" fill="var(--text-muted)">
                    Min: ${Math.round(hoveredRow.minimumsBalance).toLocaleString()}
                  </text>
                  <text y="36" className="tooltip-value text-xxs" fill="var(--accent)">
                    Snowball: ${Math.round(hoveredRow.snowballBalance).toLocaleString()}
                  </text>
                  <text y="52" className="tooltip-value font-bold text-xxs" fill="var(--primary)">
                    Avalanche: ${Math.round(hoveredRow.avalancheBalance).toLocaleString()}
                  </text>
                </g>
              </g>
            )}

            {/* Interactive Overlay */}
            <rect
              x={paddingLeft}
              y={paddingTop}
              width={plotWidth}
              height={plotHeight}
              fill="transparent"
              style={{ cursor: "crosshair" }}
              onMouseMove={(e) => {
                const svg = e.currentTarget.ownerSVGElement;
                if (!svg) return;
                const rect = svg.getBoundingClientRect();
                const mouseX = ((e.clientX - rect.left) * chartWidth) / rect.width;
                const mouseY = ((e.clientY - rect.top) * chartHeight) / rect.height;
                
                const relativeX = mouseX - paddingLeft;
                const fraction = relativeX / plotWidth;
                const index = Math.round(fraction * maxSimMonths);
                
                if (index >= 0 && index <= maxSimMonths) {
                  setHoveredIndex(index);
                  setHoverPos({ x: mouseX, y: mouseY });
                }
              }}
              onMouseLeave={() => {
                setHoveredIndex(null);
                setHoverPos(null);
              }}
            />
          </svg>
        </div>
      </Card>

      {/* 4. Action Checklist & Interest Leak Detector */}
      <div className="debts-actions-grid flex flex-col md:flex-row gap-6">
        
        {/* Recommended Payments Checklist */}
        <Card className="payment-checklist glass flex-1">
          <h3>Recommended Payments Checklist</h3>
          <p className="text-dim text-xs mb-4">Pay off your debts according to the optimized Avalanche math for this month.</p>
          
          <div className="checklist-items">
            {nextMonthChecklist.map((c, i) => (
              <div key={c.id} className={`checklist-item ${c.isTarget ? 'target-payoff' : ''}`}>
                <div className="item-main">
                  <div className="item-name flex items-center gap-2">
                    <span className="checkbox">☑️</span>
                    <span className="font-semibold">{c.name}</span>
                    {c.isTarget && <span className="target-badge">🔥 Current Target</span>}
                  </div>
                  <div className="item-math font-mono text-xs">
                    <div>Balance: ${c.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} @ {c.interestRate}%</div>
                    <div>Min: ${c.minimum}</div>
                  </div>
                </div>
                <div className="item-actions">
                  <span className="item-recommendation text-accent font-bold font-mono">
                    Pay: ${Math.round(c.recommended).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Interest Leak Detector */}
        <Card className="interest-leak glass flex-1">
          <div className="leak-header flex items-center gap-2 mb-2">
            <span className="leak-icon">🚨</span>
            <h3>Interest Leak Detector</h3>
          </div>
          <p className="text-muted text-xs mb-4">We audit your liquid cash against outstanding balances to stop interest waste.</p>

          <div className="leak-metrics glass p-3 mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span>Total Liquid Checking/Savings:</span>
              <span className="font-bold text-accent font-mono">${totalLiquidCash.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Overall Interest Rate Penalty:</span>
              <span className="font-bold text-danger font-mono">${totalDailyInterestLeak.toFixed(2)} / day</span>
            </div>
          </div>

          <div className="buffer-slider-group mb-4">
            <div className="flex justify-between items-center text-xs mb-2">
              <label className="font-semibold">Desired Emergency Cash Buffer</label>
              <span className="font-mono font-bold">${emergencyBuffer.toLocaleString()}</span>
            </div>
            <input 
              type="range" 
              min="1000" 
              max="10000" 
              step="500" 
              value={emergencyBuffer} 
              onChange={(e) => setEmergencyBuffer(Number(e.target.value))}
              className="payment-slider"
            />
          </div>

          {excessCash > 0 && highestAprDebt ? (
            <div className="leak-alert p-3">
              <div className="font-semibold text-xs text-danger mb-1">⚠️ Cash Leakage Warning</div>
              <p className="text-xxs text-dim leading-relaxed mb-2">
                You have <strong className="text-white font-mono">${Math.round(excessCash).toLocaleString()}</strong> in excess liquid cash above your emergency buffer.
                At the same time, you are carrying card/loan debt.
              </p>
              <div className="text-xs font-semibold text-accent leading-normal">
                Action: Apply ${Math.round(Math.min(excessCash, highestAprDebt.balance)).toLocaleString()} to {highestAprDebt.name} immediately.
                This instantly cuts your interest drain by ${Math.round(Math.min(excessCash, highestAprDebt.balance) * (highestAprDebt.interestRate / 100)).toLocaleString()}/year!
              </div>
            </div>
          ) : (
            <div className="leak-success p-3 text-center">
              <span className="text-success font-semibold text-xs">✅ Efficiently Deployed</span>
              <p className="text-xxs text-muted mt-1">Your liquid reserves match your buffer goal. Keep directing extra cash through your monthly budget.</p>
            </div>
          )}
        </Card>

      </div>
        </>
      )}
    </div>
  );
}
