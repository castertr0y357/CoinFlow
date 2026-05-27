"use client";

import { useState, useMemo } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { calculateAmortization, AmortizationRow } from "@/lib/services/mortgageService";
import { updateMortgageDetails, addValuationProvider, removeValuationProvider, syncValuations } from "./actions";
import "./Mortgage.css";

interface Provider {
  id: string;
  name: string;
  url: string;
  lastValue: number | null;
  lastSync: string | null;
}

interface MortgageClientProps {
  initialData: any;
  accounts: { id: string, name: string }[];
}

interface OneTimePayment {
  id: string;
  dateStr: string; // YYYY-MM
  monthIndex: number;
  amount: number;
}

export default function MortgageClient({ initialData, accounts }: MortgageClientProps) {
  const [extraPayment, setExtraPayment] = useState(0);
  const [annualExtra, setAnnualExtra] = useState(0);
  const [oneTimePayments, setOneTimePayments] = useState<OneTimePayment[]>([]);
  const [isEditing, setIsEditing] = useState(!initialData);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // States for adding one-time payment
  const [oneTimeDate, setOneTimeDate] = useState("");
  const [oneTimeAmount, setOneTimeAmount] = useState("");
  
  // Table view mode state
  const [viewMode, setViewMode] = useState<"yearly" | "monthly">("yearly");

  // States for hovering the graph
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  const formatInitialDate = (date: any) => {
    if (!date) return new Date().toISOString().split('T')[0];
    if (date instanceof Date) return date.toISOString().split('T')[0];
    if (typeof date === 'string') return date.split('T')[0];
    return new Date().toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    accountId: initialData?.accountId || "",
    interestRate: initialData?.interestRate || 6.5,
    monthlyPayment: initialData?.monthlyPayment || 2000,
    startDate: formatInitialDate(initialData?.startDate),
    termMonths: initialData?.termMonths || 360,
    homeValue: initialData?.homeValue || 400000,
    originalBalance: initialData?.originalBalance || "",
  });

  const [newProvider, setNewProvider] = useState({ name: "Zillow", url: "" });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateMortgageDetails({
        ...formData,
        originalBalance: formData.originalBalance ? Number(formData.originalBalance) : undefined,
      });
      setIsEditing(false);
    } catch (error) {
      alert("Failed to save mortgage details.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProvider = async () => {
    if (!newProvider.url) return;
    setIsSaving(true);
    try {
      await addValuationProvider(initialData.id, newProvider.name, newProvider.url);
      setNewProvider({ ...newProvider, url: "" });
    } catch (error) {
      alert("Failed to add provider.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveProvider = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    setIsSaving(true);
    try {
      await removeValuationProvider(id);
    } catch (error) {
      alert("Failed to remove provider.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncValuations = async () => {
    setIsSyncing(true);
    try {
      await syncValuations(initialData.id);
    } catch (error) {
      alert("Failed to sync valuations.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper to convert date input YYYY-MM to 1-based month index from today
  const getMonthOffset = (dateStr: string) => {
    const [year, month] = dateStr.split('-').map(Number);
    const now = new Date();
    const target = new Date(year, month - 1, 1);
    const diffMonths = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
    return Math.max(1, diffMonths + 1); // minimum month 1 offset
  };

  const handleAddOneTimePayment = () => {
    if (!oneTimeDate || !oneTimeAmount) return;
    const amount = Number(oneTimeAmount);
    if (isNaN(amount) || amount <= 0) return;
    
    const monthIndex = getMonthOffset(oneTimeDate);
    const newPayment: OneTimePayment = {
      id: Math.random().toString(36).substring(2, 9),
      dateStr: oneTimeDate,
      monthIndex,
      amount
    };

    setOneTimePayments(prev => [...prev, newPayment].sort((a, b) => a.monthIndex - b.monthIndex));
    setOneTimeDate("");
    setOneTimeAmount("");
  };

  const handleRemoveOneTimePayment = (id: string) => {
    setOneTimePayments(prev => prev.filter(p => p.id !== id));
  };

  // Amortization Schedules (Combined History & Future)
  const { schedule, optimizedSchedule, historyInterestPaid, standardFutureInterest, acceleratedFutureInterest, historyLength } = useMemo(() => {
    if (!initialData) {
      return {
        schedule: [],
        optimizedSchedule: [],
        historyInterestPaid: 0,
        standardFutureInterest: 0,
        acceleratedFutureInterest: 0,
        historyLength: 0,
      };
    }

    const start = new Date(initialData.startDate);
    const now = new Date();
    
    // Calculate calendar months elapsed between startDate and today
    const elapsedMonths = Math.max(
      0,
      (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
    );

    // 1. Historical amortization slice (Standard only, no extra payments in the past)
    let historyStd: AmortizationRow[] = [];
    if (initialData.originalBalance && elapsedMonths > 0) {
      const fullHistory = calculateAmortization(
        initialData.originalBalance,
        initialData.interestRate,
        initialData.monthlyPayment,
        0,
        0,
        [],
        start
      );
      historyStd = fullHistory.slice(0, elapsedMonths);
    }

    // 2. Future standard schedule starting today
    const futureStd = calculateAmortization(
      initialData.currentBalance,
      initialData.interestRate,
      initialData.monthlyPayment,
      0,
      0,
      [],
      now
    );

    // 3. Future accelerated schedule starting today
    const futureOpt = calculateAmortization(
      initialData.currentBalance,
      initialData.interestRate,
      initialData.monthlyPayment,
      extraPayment,
      annualExtra,
      oneTimePayments.map(p => ({ monthIndex: p.monthIndex, amount: p.amount })),
      now
    );

    const historyInterest = historyStd.reduce((sum, r) => sum + r.interest, 0);
    const stdFutureInterest = futureStd[futureStd.length - 1]?.totalInterest || 0;
    const optFutureInterest = futureOpt[futureOpt.length - 1]?.totalInterest || 0;

    // Offset future standard rows month index and cumulative interest
    const combinedStd = [
      ...historyStd,
      ...futureStd.map((row) => ({
        ...row,
        month: row.month + historyStd.length,
        totalInterest: row.totalInterest + historyInterest,
      }))
    ];

    // Offset future accelerated rows month index and cumulative interest
    const combinedOpt = [
      ...historyStd,
      ...futureOpt.map((row) => ({
        ...row,
        month: row.month + historyStd.length,
        totalInterest: row.totalInterest + historyInterest,
      }))
    ];

    return {
      schedule: combinedStd,
      optimizedSchedule: combinedOpt,
      historyInterestPaid: historyInterest,
      standardFutureInterest: stdFutureInterest,
      acceleratedFutureInterest: optFutureInterest,
      historyLength: historyStd.length,
    };
  }, [initialData, extraPayment, annualExtra, oneTimePayments]);

  // Formatted date values
  const formatDateString = (date: Date) => {
    return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  };

  // Milestones Math
  const standardPayoffDate = useMemo(() => {
    if (schedule.length === 0) return null;
    return schedule[schedule.length - 1].date;
  }, [schedule]);

  const optimizedPayoffDate = useMemo(() => {
    if (optimizedSchedule.length === 0) return null;
    return optimizedSchedule[optimizedSchedule.length - 1].date;
  }, [optimizedSchedule]);

  const baseTotalInterest = schedule[schedule.length - 1]?.totalInterest || 0;
  const optimizedTotalInterest = optimizedSchedule[optimizedSchedule.length - 1]?.totalInterest || 0;
  const interestSaved = baseTotalInterest - optimizedTotalInterest;
  const monthsSaved = schedule.length - optimizedSchedule.length;

  const standardTotalCost = initialData ? (initialData.originalBalance || initialData.currentBalance) + baseTotalInterest : 0;
  const optimizedTotalCost = initialData ? (initialData.originalBalance || initialData.currentBalance) + optimizedTotalInterest : 0;

  // Find Tipping Points (where Principal Paid > Interest Paid in a single month)
  const standardTippingPoint = useMemo(() => {
    return schedule.find(row => row.principal > row.interest);
  }, [schedule]);

  const optimizedTippingPoint = useMemo(() => {
    return optimizedSchedule.find(row => row.principal > row.interest);
  }, [optimizedSchedule]);

  // Find Equity Milestones (20% and 50% Equity based on current Home Value)
  const homeValue = initialData?.homeValue || 0;
  const equityThreshold20 = homeValue * 0.8;
  const equityThreshold50 = homeValue * 0.5;

  const standardEquity20 = useMemo(() => {
    if (homeValue <= 0) return null;
    return schedule.find(row => row.balance <= equityThreshold20);
  }, [schedule, homeValue, equityThreshold20]);

  const optimizedEquity20 = useMemo(() => {
    if (homeValue <= 0) return null;
    return optimizedSchedule.find(row => row.balance <= equityThreshold20);
  }, [optimizedSchedule, homeValue, equityThreshold20]);

  const standardEquity50 = useMemo(() => {
    if (homeValue <= 0) return null;
    return schedule.find(row => row.balance <= equityThreshold50);
  }, [schedule, homeValue, equityThreshold50]);

  const optimizedEquity50 = useMemo(() => {
    if (homeValue <= 0) return null;
    return optimizedSchedule.find(row => row.balance <= equityThreshold50);
  }, [optimizedSchedule, homeValue, equityThreshold50]);

  // Yearly summary groupings
  const yearlySummary = useMemo(() => {
    const result: {
      year: number;
      principalPaidStd: number;
      interestPaidStd: number;
      balanceStd: number;
      principalPaidOpt: number;
      interestPaidOpt: number;
      extraPaidOpt: number;
      balanceOpt: number;
    }[] = [];

    // Group standard schedule by calendar year
    const stdByYear: Record<number, AmortizationRow[]> = {};
    schedule.forEach(row => {
      const y = row.date.getUTCFullYear();
      if (!stdByYear[y]) stdByYear[y] = [];
      stdByYear[y].push(row);
    });

    // Group optimized schedule by calendar year
    const optByYear: Record<number, AmortizationRow[]> = {};
    optimizedSchedule.forEach(row => {
      const y = row.date.getUTCFullYear();
      if (!optByYear[y]) optByYear[y] = [];
      optByYear[y].push(row);
    });

    const allYears = Array.from(new Set([
      ...Object.keys(stdByYear).map(Number),
      ...Object.keys(optByYear).map(Number)
    ])).sort((a, b) => a - b);

    allYears.forEach(y => {
      const stdRows = stdByYear[y] || [];
      const optRows = optByYear[y] || [];

      const principalPaidStd = stdRows.reduce((sum, r) => sum + r.principal, 0);
      const interestPaidStd = stdRows.reduce((sum, r) => sum + r.interest, 0);
      const balanceStd = stdRows.length > 0 ? stdRows[stdRows.length - 1].balance : (result[result.length - 1]?.balanceStd || 0);

      const principalPaidOpt = optRows.reduce((sum, r) => sum + r.principal, 0);
      const interestPaidOpt = optRows.reduce((sum, r) => sum + r.interest, 0);
      const extraPaidOpt = optRows.reduce((sum, r) => sum + (r.extraPaid || 0), 0);
      const balanceOpt = optRows.length > 0 ? optRows[optRows.length - 1].balance : 0;

      result.push({
        year: y,
        principalPaidStd,
        interestPaidStd,
        balanceStd,
        principalPaidOpt,
        interestPaidOpt,
        extraPaidOpt,
        balanceOpt,
      });
    });

    return result;
  }, [schedule, optimizedSchedule]);

  // SVG Chart Setup
  const chartWidth = 800;
  const chartHeight = 280;
  const paddingLeft = 70;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 40;
  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const maxBalance = initialData?.originalBalance || initialData?.currentBalance || 100000;
  
  const standardPoints = useMemo(() => {
    if (schedule.length === 0) return [];
    return schedule.map((row, i) => {
      const x = paddingLeft + (i / (schedule.length - 1 || 1)) * plotWidth;
      const y = chartHeight - paddingBottom - (row.balance / maxBalance) * plotHeight;
      return { x, y, row };
    });
  }, [schedule, maxBalance, plotWidth, plotHeight]);

  const optimizedPoints = useMemo(() => {
    if (optimizedSchedule.length === 0) return [];
    return optimizedSchedule.map((row, i) => {
      const x = paddingLeft + (i / (schedule.length - 1 || 1)) * plotWidth;
      const y = chartHeight - paddingBottom - (row.balance / maxBalance) * plotHeight;
      return { x, y, row };
    });
  }, [optimizedSchedule, schedule.length, maxBalance, plotWidth, plotHeight]);

  const historyPoints = useMemo(() => {
    return standardPoints.slice(0, historyLength + 1);
  }, [standardPoints, historyLength]);

  const standardFuturePoints = useMemo(() => {
    return standardPoints.slice(historyLength);
  }, [standardPoints, historyLength]);

  const optimizedFuturePoints = useMemo(() => {
    return optimizedPoints.slice(historyLength);
  }, [optimizedPoints, historyLength]);

  const historyPath = useMemo(() => {
    return historyPoints.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  }, [historyPoints]);

  const standardFuturePath = useMemo(() => {
    return standardFuturePoints.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  }, [standardFuturePoints]);

  const optimizedFuturePath = useMemo(() => {
    return optimizedFuturePoints.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(" ");
  }, [optimizedFuturePoints]);

  const historyAreaPath = useMemo(() => {
    if (historyPoints.length === 0) return "";
    return `${historyPath} L ${historyPoints[historyPoints.length - 1].x} ${chartHeight - paddingBottom} L ${historyPoints[0].x} ${chartHeight - paddingBottom} Z`;
  }, [historyPoints, historyPath, chartHeight, paddingBottom]);

  const standardFutureAreaPath = useMemo(() => {
    if (standardFuturePoints.length === 0) return "";
    return `${standardFuturePath} L ${standardFuturePoints[standardFuturePoints.length - 1].x} ${chartHeight - paddingBottom} L ${standardFuturePoints[0].x} ${chartHeight - paddingBottom} Z`;
  }, [standardFuturePoints, standardFuturePath, chartHeight, paddingBottom]);

  const optimizedFutureAreaPath = useMemo(() => {
    if (optimizedFuturePoints.length === 0) return "";
    return `${optimizedFuturePath} L ${optimizedFuturePoints[optimizedFuturePoints.length - 1].x} ${chartHeight - paddingBottom} L ${optimizedFuturePoints[0].x} ${chartHeight - paddingBottom} Z`;
  }, [optimizedFuturePoints, optimizedFuturePath, chartHeight, paddingBottom]);

  const hoveredStd = hoveredIndex !== null ? standardPoints[hoveredIndex] : null;
  const hoveredOpt = hoveredIndex !== null ? optimizedPoints[hoveredIndex] : null;

  const yearTicks = useMemo(() => {
    if (schedule.length === 0) return [];
    const ticks: { x: number, label: string }[] = [];
    let lastTickYear = -1;
    // Aim for 5-6 ticks total
    const tickIntervalYears = Math.max(1, Math.floor(schedule.length / 12 / 5));

    for (let i = 0; i < schedule.length; i++) {
      const row = schedule[i];
      const y = row.date.getUTCFullYear();
      if (y !== lastTickYear && (ticks.length === 0 || y - lastTickYear >= tickIntervalYears)) {
        const x = paddingLeft + (i / (schedule.length - 1 || 1)) * plotWidth;
        ticks.push({ x, label: String(y) });
        lastTickYear = y;
      }
    }
    return ticks;
  }, [schedule, plotWidth]);

  return (
    <div className="mortgage-dashboard">
      <header className="page-header-flex">
        <div>
          <h1>Mortgage Mastery</h1>
          <p className="text-muted">Track equity and optimize your payoff strategy.</p>
        </div>
        {initialData && !isEditing && (
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            ⚙️ Edit Core Details
          </Button>
        )}
      </header>

      {isEditing ? (
        <Card className="mortgage-setup glass">
          <h2>{initialData ? "Edit Mortgage Details" : "Mortgage Setup"}</h2>
          <form onSubmit={handleSave} className="setup-form">
            <div className="form-group">
              <label>Linked Account</label>
              <select value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})} required>
                <option value="">Select account...</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Interest Rate (%)</label>
                <input type="number" step="0.01" value={formData.interestRate} onChange={e => setFormData({...formData, interestRate: Number(e.target.value)})} required />
              </div>
              <div className="form-group">
                <label>Monthly P&I Payment ($)</label>
                <input type="number" value={formData.monthlyPayment} onChange={e => setFormData({...formData, monthlyPayment: Number(e.target.value)})} required />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Mortgage Start Date</label>
                <input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>Mortgage Term (Months)</label>
                <input type="number" value={formData.termMonths} onChange={e => setFormData({...formData, termMonths: Number(e.target.value)})} placeholder="e.g. 360 for 30 years" required />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Original Loan Amount ($)</label>
                <input type="number" value={formData.originalBalance} onChange={e => setFormData({...formData, originalBalance: e.target.value ? Number(e.target.value) : ""})} placeholder="e.g. 400000" />
              </div>
              <div className="form-group">
                <label>Manual Home Value (Fallback)</label>
                <input type="number" value={formData.homeValue} onChange={e => setFormData({...formData, homeValue: Number(e.target.value)})} />
              </div>
            </div>
            <div className="form-actions mt-4">
              <Button type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Mortgage Details"}
              </Button>
              {initialData && <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>}
            </div>
          </form>
        </Card>
      ) : (
        <>
      {/* Stat Cards */}
      <div className="mortgage-stats-grid">
        <Card className="stat-card accent" animate={true}>
          <span className="stat-label">Current Balance</span>
          <div className="stat-value">${initialData.currentBalance.toLocaleString()}</div>
          <span className="stat-sub">Estimated Equity: ${Math.max(0, (initialData.homeValue || 0) - initialData.currentBalance).toLocaleString()}</span>
        </Card>
        
        <Card className="stat-card secondary" animate={true} delay="0.1s">
          <span className="stat-label">Avg. Home Value</span>
          <div className="stat-value">${(initialData.homeValue || 0).toLocaleString()}</div>
          <span className="stat-sub">From {initialData.providers?.length || 0} Sources</span>
        </Card>

        <Card className="stat-card danger" animate={true} delay="0.2s">
          <span className="stat-label">Accelerated Payoff Savings</span>
          <div className="stat-value text-accent">${interestSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <span className="stat-sub">Shaved {monthsSaved} months off term ({ (monthsSaved/12).toFixed(1) } years)</span>
        </Card>
      </div>

      {/* Trajectory SVG Chart */}
      <Card className="chart-card glass" animate={true}>
        <div className="chart-header flex justify-between items-center">
          <div>
            <h3>Payoff Trajectory</h3>
            <p className="text-dim text-xs">Standard vs. Accelerated remaining balance projection</p>
          </div>
          <div className="chart-legend flex gap-4 text-xs">
            {historyLength > 0 && (
              <span className="flex items-center gap-1"><span className="legend-dot history-dot"></span> Past Payments</span>
            )}
            <span className="flex items-center gap-1"><span className="legend-dot std-dot"></span> Standard Projection</span>
            <span className="flex items-center gap-1"><span className="legend-dot acc-dot"></span> Accelerated Strategy</span>
          </div>
        </div>

        <div className="chart-wrapper mt-4">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="mortgage-svg">
            <defs>
              <linearGradient id="historyGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--success)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="var(--success)" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="stdGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="accGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.3" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            <line x1={paddingLeft} y1={paddingTop} x2={chartWidth - paddingRight} y2={paddingTop} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
            <line x1={paddingLeft} y1={paddingTop + plotHeight / 2} x2={chartWidth - paddingRight} y2={paddingTop + plotHeight / 2} stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
            <line x1={paddingLeft} y1={chartHeight - paddingBottom} x2={chartWidth - paddingRight} y2={chartHeight - paddingBottom} stroke="rgba(255,255,255,0.1)" />

            {/* Fills */}
            {historyAreaPath && <path d={historyAreaPath} fill="url(#historyGradient)" />}
            {standardFutureAreaPath && <path d={standardFutureAreaPath} fill="url(#stdGradient)" />}
            {optimizedFutureAreaPath && <path d={optimizedFutureAreaPath} fill="url(#accGradient)" />}

            {/* Trajectory Lines */}
            {historyPath && <path d={historyPath} fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
            {standardFuturePath && <path d={standardFuturePath} fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeDasharray="5 5" />}
            {optimizedFuturePath && <path d={optimizedFuturePath} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}

            {/* Today Marker */}
            {standardPoints[historyLength] && (
              <g>
                <line 
                  x1={standardPoints[historyLength].x} 
                  y1={paddingTop} 
                  x2={standardPoints[historyLength].x} 
                  y2={chartHeight - paddingBottom} 
                  stroke="var(--accent)" 
                  strokeWidth="1.5" 
                  strokeDasharray="4 4" 
                />
                <circle 
                  cx={standardPoints[historyLength].x} 
                  cy={standardPoints[historyLength].y} 
                  r="6" 
                  fill="var(--accent)" 
                  stroke="var(--bg-color, #0d0e12)" 
                  strokeWidth="2.5" 
                />
                <text 
                  x={standardPoints[historyLength].x} 
                  y={paddingTop - 8} 
                  textAnchor="middle" 
                  className="today-badge font-bold text-xs" 
                  fill="var(--accent)"
                >
                  TODAY
                </text>
                <text 
                  x={standardPoints[historyLength].x + 10} 
                  y={standardPoints[historyLength].y + 4} 
                  textAnchor="start" 
                  className="today-value-label font-bold text-xs" 
                  fill="var(--accent)"
                >
                  ${initialData.currentBalance.toLocaleString()}
                </text>
              </g>
            )}

            {/* End Dots & Annotations */}
            {standardPoints.length > 0 && (
              <g>
                <circle cx={standardPoints[standardPoints.length - 1].x} cy={standardPoints[standardPoints.length - 1].y} r="5" fill="var(--text-muted)" />
                <text x={standardPoints[standardPoints.length - 1].x} y={standardPoints[standardPoints.length - 1].y - 12} textAnchor="end" className="chart-node-label" fill="var(--text-dim)">
                  {standardPayoffDate ? formatDateString(standardPayoffDate) : ""}
                </text>
              </g>
            )}

            {optimizedPoints.length > 0 && optimizedPoints.length < standardPoints.length && (
              <g>
                <circle cx={optimizedPoints[optimizedPoints.length - 1].x} cy={optimizedPoints[optimizedPoints.length - 1].y} r="6" fill="var(--primary)" />
                <text x={optimizedPoints[optimizedPoints.length - 1].x} y={optimizedPoints[optimizedPoints.length - 1].y - 14} textAnchor="middle" className="chart-node-label font-bold" fill="var(--primary)">
                  {optimizedPayoffDate ? formatDateString(optimizedPayoffDate) : ""}
                </text>
              </g>
            )}

            {/* X Axis Labels */}
            {yearTicks.map((tick, i) => (
              <text key={i} x={tick.x} y={chartHeight - 12} textAnchor="middle" className="axis-label" fill="var(--text-muted)">
                {tick.label}
              </text>
            ))}

            {/* Y Axis Labels */}
            <text x={paddingLeft - 10} y={paddingTop + 4} textAnchor="end" className="axis-label" fill="var(--text-muted)">
              ${(maxBalance / 1000).toFixed(0)}k
            </text>
            <text x={paddingLeft - 10} y={paddingTop + plotHeight / 2 + 4} textAnchor="end" className="axis-label" fill="var(--text-muted)">
              ${(maxBalance / 2 / 1000).toFixed(0)}k
            </text>
            <text x={paddingLeft - 10} y={chartHeight - paddingBottom + 4} textAnchor="end" className="axis-label" fill="var(--text-muted)">
              $0
            </text>

            {/* Hover Tracker vertical line and circle dots */}
            {hoveredIndex !== null && hoveredStd && (
              <g>
                <line 
                  x1={hoveredStd.x} 
                  y1={paddingTop} 
                  x2={hoveredStd.x} 
                  y2={chartHeight - paddingBottom} 
                  stroke="rgba(255, 255, 255, 0.15)" 
                  strokeWidth="1" 
                  strokeDasharray="2 2" 
                />
                <circle 
                  cx={hoveredStd.x} 
                  cy={hoveredStd.y} 
                  r="4" 
                  fill="var(--text-muted)" 
                />
                {hoveredOpt && (
                  <circle 
                    cx={hoveredOpt.x} 
                    cy={hoveredOpt.y} 
                    r="4" 
                    fill="var(--primary)" 
                    stroke="var(--bg-color, #0d0e12)" 
                    strokeWidth="1.5" 
                  />
                )}
              </g>
            )}

            {/* Hover Tooltip Box */}
            {hoveredIndex !== null && hoveredStd && hoverPos && (
              <g className="chart-tooltip">
                <rect
                  x={hoveredStd.x + 10 + 125 > chartWidth - paddingRight ? hoveredStd.x - 135 : hoveredStd.x + 10}
                  y={Math.min(chartHeight - paddingBottom - 85, Math.max(paddingTop + 10, hoveredStd.y - 45))}
                  width="125"
                  height="75"
                  rx="8"
                  fill="rgba(13, 14, 18, 0.95)"
                  stroke="var(--glass-border)"
                  strokeWidth="1.5"
                />
                <g transform={`translate(${hoveredStd.x + 10 + 125 > chartWidth - paddingRight ? hoveredStd.x - 125 : hoveredStd.x + 20}, ${Math.min(chartHeight - paddingBottom - 85, Math.max(paddingTop + 10, hoveredStd.y - 45)) + 18})`}>
                  {/* Date */}
                  <text className="tooltip-date font-bold text-xs" fill="white">
                    {formatDateString(hoveredStd.row.date)}
                  </text>
                  {/* Standard Balance */}
                  <text y="20" className="tooltip-value text-xxs" fill="var(--text-muted)">
                    Std: ${Math.round(hoveredStd.row.balance).toLocaleString()}
                  </text>
                  {/* Accelerated Balance */}
                  <text y="36" className="tooltip-value font-bold text-xxs" fill="var(--primary)">
                    Acc: {hoveredOpt ? `$${Math.round(hoveredOpt.row.balance).toLocaleString()}` : "$0"}
                  </text>
                  {/* Difference */}
                  {hoveredOpt && hoveredStd.row.balance - hoveredOpt.row.balance > 0 && (
                    <text y="50" className="tooltip-diff font-semibold text-xxs" fill="var(--accent)">
                      Diff: +${Math.round(hoveredStd.row.balance - hoveredOpt.row.balance).toLocaleString()}
                    </text>
                  )}
                </g>
              </g>
            )}

            {/* Invisible interactive rectangle overlay for capturing hover coordinates */}
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
                
                // Map coordinates back to schedule index
                const relativeX = mouseX - paddingLeft;
                const fraction = relativeX / plotWidth;
                const index = Math.round(fraction * (schedule.length - 1));
                
                if (index >= 0 && index < schedule.length) {
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

      {/* Main Grid: Accelerator & Visualizations */}
      <div className="mortgage-tools">
        {/* Accelerator Column */}
        <div className="flex flex-col gap-6">
          <Card className="payoff-calculator glass">
            <h3>Payoff Accelerator</h3>
            <p className="text-muted">Simulate extra payments to see your interest savings compound.</p>
            
            <div className="calculator-ui mt-6">
              {/* Monthly Extra */}
              <div className="slider-group">
                <div className="flex justify-between items-center mb-2">
                  <label className="slider-title font-semibold text-sm">Monthly Extra Payment</label>
                  <div className="flex items-center gap-1">
                    <span className="text-accent font-semibold text-sm">$</span>
                    <input 
                      type="number" 
                      min="0" 
                      value={extraPayment} 
                      onChange={(e) => setExtraPayment(Math.max(0, Number(e.target.value)))} 
                      className="manual-extra-input"
                    />
                    <span className="text-muted text-xs">/ mo</span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="3000" 
                  step="50" 
                  value={Math.min(extraPayment, 3000)} 
                  onChange={(e) => setExtraPayment(Number(e.target.value))}
                  className="payment-slider"
                />
                <div className="slider-labels text-xs flex justify-between text-muted mt-1">
                  <span>$0</span>
                  <span>$3,000</span>
                </div>
              </div>

              {/* Annual Extra */}
              <div className="slider-group mt-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="slider-title font-semibold text-sm">Annual Recurring Extra</label>
                  <div className="flex items-center gap-1">
                    <span className="text-accent font-semibold text-sm">$</span>
                    <input 
                      type="number" 
                      min="0" 
                      value={annualExtra} 
                      onChange={(e) => setAnnualExtra(Math.max(0, Number(e.target.value)))} 
                      className="manual-extra-input"
                    />
                    <span className="text-muted text-xs">/ yr</span>
                  </div>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="15000" 
                  step="250" 
                  value={Math.min(annualExtra, 15000)} 
                  onChange={(e) => setAnnualExtra(Number(e.target.value))}
                  className="payment-slider"
                />
                <div className="slider-labels text-xs flex justify-between text-muted mt-1">
                  <span>$0</span>
                  <span>$15,000</span>
                </div>
              </div>

              {/* Results Preview */}
              <div className="results-grid mt-6 pt-4 border-t border-glass-border">
                <div className="result-item">
                  <span className="label">Payoff Target Date</span>
                  <span className="value text-lg font-bold text-white">
                    {optimizedPayoffDate ? formatDateString(optimizedPayoffDate) : "—"}
                  </span>
                </div>
                <div className="result-item">
                  <span className="label">Total Term Saved</span>
                  <span className="value text-lg font-bold text-accent">
                    {monthsSaved > 0 ? `${monthsSaved} months (${(monthsSaved / 12).toFixed(1)} yrs)` : "0 months"}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* One-Time Payments List Manager */}
          <Card className="one-time-manager glass">
            <h3>One-Time Lump Sums</h3>
            <p className="text-muted text-xs">Inject lump sum payments at specific dates (e.g. bonuses, tax refunds).</p>

            <div className="lump-sum-form mt-4 flex gap-2">
              <input 
                type="month" 
                value={oneTimeDate} 
                onChange={e => setOneTimeDate(e.target.value)} 
                min={new Date().toISOString().substring(0, 7)}
                className="lump-date-input"
              />
              <input 
                type="number" 
                placeholder="Amount ($)" 
                value={oneTimeAmount} 
                onChange={e => setOneTimeAmount(e.target.value)}
                className="lump-amount-input"
              />
              <Button variant="secondary" size="sm" onClick={handleAddOneTimePayment}>Add</Button>
            </div>

            <div className="lump-sum-list mt-4 overflow-y-auto max-h-40">
              {oneTimePayments.length === 0 ? (
                <p className="text-dim text-xs py-2">No lump sums configured yet.</p>
              ) : (
                oneTimePayments.map(p => (
                  <div key={p.id} className="lump-sum-item flex justify-between items-center py-2 px-3 bg-white/5 rounded-lg border border-white/5 mb-2 text-xs">
                    <span>
                      📅 <strong>{p.dateStr}</strong>
                    </span>
                    <span className="font-semibold text-accent">${p.amount.toLocaleString()}</span>
                    <button 
                      onClick={() => handleRemoveOneTimePayment(p.id)} 
                      className="text-danger hover:text-red-400 bg-transparent border-none cursor-pointer font-bold px-1"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* side Column */}
        <div className="mortgage-side-tools flex flex-col gap-6">
          {/* Equity & Progress Visualizer */}
          <Card className="equity-viz glass">
            <h3>Payoff & Equity Progress</h3>
            <p className="text-muted text-xs mb-4">Visual representation of outstanding debt vs home equity</p>
            <div className="equity-bar-container">
               <div className="equity-bar">
                  <div className="bar-fill principal" style={{ width: `${(initialData.currentBalance / (initialData.homeValue || 1)) * 100}%` }}></div>
               </div>
               <div className="bar-labels mt-2 text-xs font-semibold flex justify-between">
                  <span className="text-danger">Debt: {((initialData.currentBalance / (initialData.homeValue || 1)) * 100).toFixed(1)}% (${initialData.currentBalance.toLocaleString()})</span>
                  <span className="text-success">Equity: {(((initialData.homeValue || 0) - initialData.currentBalance) / (initialData.homeValue || 1) * 100).toFixed(1)}% (${Math.max(0, (initialData.homeValue || 0) - initialData.currentBalance).toLocaleString()})</span>
               </div>
            </div>
            <div className="mt-6">
              <Button variant="ghost" size="sm" onClick={handleSyncValuations} disabled={isSyncing || initialData.providers?.length === 0} style={{ width: "100%" }}>
                {isSyncing ? "⏳ Syncing..." : "🔄 Sync Live Values"}
              </Button>
            </div>
          </Card>

          {/* Valuation Sources */}
          <Card className="valuation-sources glass">
            <h3>Home Valuation Sources</h3>
            <p className="text-muted text-xs">Link Zillow, Redfin, or Realtor listing pages to automatically pull estimates.</p>
            
            <div className="providers-list mt-4">
              {initialData.providers?.length === 0 ? (
                <p className="text-muted py-4 text-center text-xs">No live sources linked. Paste a property URL below.</p>
              ) : (
                initialData.providers?.map((p: Provider) => (
                  <div key={p.id} className="provider-item">
                    <div className="provider-header">
                      <span className="provider-name">{p.name}</span>
                      <button 
                        onClick={() => handleRemoveProvider(p.id)} 
                        className="delete-provider-btn"
                        title="Delete source"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="provider-body">
                      <span className="provider-value text-accent font-bold">
                        {p.lastValue !== null ? `$${Number(p.lastValue).toLocaleString()}` : "—"}
                      </span>
                      <span className="provider-sync text-xs text-muted">
                        Synced: {p.lastSync ? new Date(p.lastSync).toLocaleDateString(undefined, { timeZone: 'UTC' }) : 'Never'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="add-provider mt-4 pt-4 border-t border-glass-border">
              <div className="provider-form flex gap-2">
                <select 
                  value={newProvider.name} 
                  onChange={e => setNewProvider({...newProvider, name: e.target.value})}
                  className="bg-black/20 border border-glass-border text-white text-xs rounded p-2"
                >
                  <option>Zillow</option>
                  <option>Redfin</option>
                  <option>Realtor</option>
                </select>
                <input 
                  type="text" 
                  placeholder="Paste property URL here..." 
                  value={newProvider.url} 
                  onChange={e => setNewProvider({...newProvider, url: e.target.value})}
                  className="bg-black/20 border border-glass-border text-white text-xs rounded p-2 flex-1"
                />
                <Button variant="secondary" size="sm" onClick={handleAddProvider} disabled={isSaving}>
                   Add
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Comparison Milestones Panel */}
      <Card className="milestones-card glass" animate={true}>
        <h3>Financial Strategy Comparison</h3>
        <p className="text-muted text-xs">Compare performance statistics side by side between the standard amortization and accelerated payoff models.</p>

        <div className="milestones-table-wrapper mt-6">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Strategy Metric</th>
                <th>Standard Schedule</th>
                <th>Accelerated Strategy</th>
                <th>Savings / Benefit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Final Payoff Date</strong></td>
                <td>{standardPayoffDate ? formatDateString(standardPayoffDate) : "—"}</td>
                <td className="text-primary font-bold">{optimizedPayoffDate ? formatDateString(optimizedPayoffDate) : "—"}</td>
                <td className="text-accent font-bold">{monthsSaved > 0 ? `${monthsSaved} months faster (${(monthsSaved / 12).toFixed(1)} yrs)` : "—"}</td>
              </tr>
              <tr>
                <td><strong>Total Interest Paid</strong></td>
                <td>${baseTotalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td>${optimizedTotalInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="text-accent font-bold">${interestSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })} saved</td>
              </tr>
              <tr>
                <td><strong>Total Cost of Loan</strong> (Remaining)</td>
                <td>${standardTotalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td>${optimizedTotalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="text-accent font-bold">${interestSaved.toLocaleString(undefined, { maximumFractionDigits: 0 })} saved</td>
              </tr>
              <tr>
                <td><strong>Interest Tipping Point</strong> (Principal &gt; Interest)</td>
                <td>{standardTippingPoint ? formatDateString(standardTippingPoint.date) : "Already reached"}</td>
                <td className="text-primary font-bold">{optimizedTippingPoint ? formatDateString(optimizedTippingPoint.date) : "Already reached"}</td>
                <td className="text-accent font-bold">
                  {standardTippingPoint && optimizedTippingPoint && standardTippingPoint.month > optimizedTippingPoint.month
                    ? `${standardTippingPoint.month - optimizedTippingPoint.month} months earlier`
                    : "—"}
                </td>
              </tr>
              <tr>
                <td><strong>20% Equity Milestone</strong> (80% Loan-to-Value)</td>
                <td>{standardEquity20 ? formatDateString(standardEquity20.date) : "Already reached"}</td>
                <td className="text-primary font-bold">{optimizedEquity20 ? formatDateString(optimizedEquity20.date) : "Already reached"}</td>
                <td className="text-accent font-bold">
                  {standardEquity20 && optimizedEquity20 && standardEquity20.month > optimizedEquity20.month
                    ? `${standardEquity20.month - optimizedEquity20.month} months earlier`
                    : "—"}
                </td>
              </tr>
              <tr>
                <td><strong>50% Equity Milestone</strong> (50% Loan-to-Value)</td>
                <td>{standardEquity50 ? formatDateString(standardEquity50.date) : "—"}</td>
                <td className="text-primary font-bold">{optimizedEquity50 ? formatDateString(optimizedEquity50.date) : "—"}</td>
                <td className="text-accent font-bold">
                  {standardEquity50 && optimizedEquity50 && standardEquity50.month > optimizedEquity50.month
                    ? `${standardEquity50.month - optimizedEquity50.month} months earlier`
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Amortization Details Table */}
      <Card className="schedule-table-card glass" animate={true}>
        <div className="schedule-header flex justify-between items-center mb-4">
          <div>
            <h3>Amortization Schedule Details</h3>
            <p className="text-muted text-xs">Examine payment-by-payment breakdowns and outstanding principal balances</p>
          </div>
          <div className="view-toggle flex bg-black/20 rounded border border-white/5 p-1">
            <button 
              className={`px-3 py-1 text-xs rounded border-none cursor-pointer transition ${viewMode === "yearly" ? "bg-primary text-white" : "bg-transparent text-muted hover:text-white"}`}
              onClick={() => setViewMode("yearly")}
            >
              Yearly Summary
            </button>
            <button 
              className={`px-3 py-1 text-xs rounded border-none cursor-pointer transition ${viewMode === "monthly" ? "bg-primary text-white" : "bg-transparent text-muted hover:text-white"}`}
              onClick={() => setViewMode("monthly")}
            >
              Monthly Details
            </button>
          </div>
        </div>

        {viewMode === "yearly" ? (
          <div className="table-responsive">
            <table className="schedule-table">
              <thead>
                <tr className="header-group">
                  <th></th>
                  <th colSpan={3} className="text-center group-std bg-white/5">Standard Schedule</th>
                  <th colSpan={4} className="text-center group-opt bg-primary/10">Accelerated Strategy</th>
                </tr>
                <tr className="header-sub text-xs">
                  <th>Calendar Year</th>
                  <th className="bg-white/5">Principal</th>
                  <th className="bg-white/5">Interest</th>
                  <th className="bg-white/5 border-r border-white/10">Ending Balance</th>
                  <th className="bg-primary/10">Principal</th>
                  <th className="bg-primary/10">Interest</th>
                  <th className="bg-primary/10">Extra Paid</th>
                  <th className="bg-primary/10">Ending Balance</th>
                </tr>
              </thead>
              <tbody>
                {yearlySummary.map((row, i) => (
                  <tr key={i} className="text-xs">
                    <td><strong>{row.year}</strong></td>
                    <td>${row.principalPaidStd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td>${row.interestPaidStd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className="border-r border-white/10 text-muted">${row.balanceStd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td>${row.principalPaidOpt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td>${row.interestPaidOpt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <td className={row.extraPaidOpt > 0 ? "text-accent font-semibold" : "text-muted"}>
                      ${row.extraPaidOpt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="font-semibold">${row.balanceOpt.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-responsive max-h-96 overflow-y-auto pr-1">
            <table className="schedule-table sticky-header">
              <thead>
                <tr className="header-group">
                  <th></th>
                  <th colSpan={2} className="text-center group-std bg-white/5">Standard Plan</th>
                  <th colSpan={3} className="text-center group-opt bg-primary/10">Accelerated Plan</th>
                </tr>
                <tr className="header-sub text-xs">
                  <th>Month</th>
                  <th className="bg-white/5">Interest</th>
                  <th className="bg-white/5 border-r border-white/10">Balance</th>
                  <th className="bg-primary/10">Interest</th>
                  <th className="bg-primary/10">Extra Paid</th>
                  <th className="bg-primary/10">Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Find max length of standard and optimized schedules */}
                {Array.from({ length: Math.max(schedule.length, optimizedSchedule.length) }).map((_, idx) => {
                  const std = schedule[idx];
                  const opt = optimizedSchedule[idx];
                  const displayDate = opt?.date || std?.date;

                  if (!displayDate) return null;

                  return (
                    <tr key={idx} className="text-xs">
                      <td><strong>{displayDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' })}</strong></td>
                      <td>{std ? `$${std.interest.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}</td>
                      <td className="border-r border-white/10 text-muted">{std ? `$${std.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}</td>
                      <td>{opt ? `$${opt.interest.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}</td>
                      <td className={opt && (opt.extraPaid || 0) > 0 ? "text-accent font-semibold" : "text-muted"}>
                        {opt ? `$${(opt.extraPaid || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                      </td>
                      <td className="font-semibold">{opt ? `$${opt.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "$0"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </>
      )}
    </div>
  );
}
