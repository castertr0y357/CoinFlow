"use client";

import { useState, useMemo } from "react";
import Card from "@/components/ui/Card";
import { buildWealthProjection } from "@/lib/services/planningService";

interface WealthClientProps {
  initialData: {
    currentInvestments: number;
    currentCash: number;
    defaultContribution: number;
    defaultFiTarget: number;
    investmentAccounts: { id: string; name: string; balance: number }[];
    mortgage: {
      balance: number;
      interestRate: number;
      monthlyPayment: number;
    } | null;
  };
}

export default function WealthClient({ initialData }: WealthClientProps) {
  const [monthlyContribution, setMonthlyContribution] = useState<number>(initialData.defaultContribution);
  const [annualReturnPct, setAnnualReturnPct] = useState<number>(7.0);
  const [years, setYears] = useState<number>(20);
  const [fiTarget, setFiTarget] = useState<number>(initialData.defaultFiTarget);
  const [redirectMortgage, setRedirectMortgage] = useState<boolean>(true);

  const projection = useMemo(() => {
    return buildWealthProjection({
      currentInvestments: initialData.currentInvestments,
      currentCash: initialData.currentCash,
      monthlyContribution,
      annualReturnPct,
      years,
      fiTarget,
      mortgage: initialData.mortgage,
      redirectMortgageAfterPayoff: redirectMortgage,
    });
  }, [initialData, monthlyContribution, annualReturnPct, years, fiTarget, redirectMortgage]);

  // SVG chart
  const pts = projection.schedule;
  const maxVal = Math.max(...pts.map((p) => Math.max(p.baseline, p.accelerated)), fiTarget, 10000);
  const width = 820;
  const height = 260;
  const padL = 80;
  const padR = 25;
  const padT = 25;
  const padB = 35;
  const cw = width - padL - padR;
  const ch = height - padT - padB;

  const toCoords = (val: number, idx: number) => ({
    x: padL + (idx / Math.max(1, pts.length - 1)) * cw,
    y: height - padB - (val / maxVal) * ch,
  });

  const basePath = pts
    .map((p, i) => {
      const c = toCoords(p.baseline, i);
      return `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`;
    })
    .join(" ");

  const accelPath = pts
    .map((p, i) => {
      const c = toCoords(p.accelerated, i);
      return `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`;
    })
    .join(" ");

  const targetY = height - padB - (fiTarget / maxVal) * ch;

  const fmtCompact = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(2)}M`
      : `$${Math.round(n).toLocaleString()}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "1rem" }}>
        <Card className="glass">
          <span className="text-xs text-muted">Current Invested Assets</span>
          <h2 style={{ margin: "0.35rem 0", fontSize: "1.6rem" }}>{fmtCompact(initialData.currentInvestments)}</h2>
          <span className="text-xs text-muted">{initialData.investmentAccounts.length} synced investment account(s)</span>
        </Card>

        <Card className="glass" style={{ borderColor: "rgba(96, 165, 250, 0.4)" }}>
          <span className="text-xs text-muted">Projected in {years} Years</span>
          <h2 style={{ margin: "0.35rem 0", fontSize: "1.6rem", color: "#60a5fa" }}>
            {fmtCompact(projection.finalAccelerated)}
          </h2>
          <span className="text-xs text-muted">Baseline: {fmtCompact(projection.finalBaseline)}</span>
        </Card>

        <Card className="glass">
          <span className="text-xs text-muted">Mortgage-Free Boost</span>
          <h2 style={{ margin: "0.35rem 0", fontSize: "1.6rem", color: "#34d399" }}>
            +{fmtCompact(projection.mortgageBoost)}
          </h2>
          <span className="text-xs text-muted">
            {projection.mortgagePayoffYear
              ? `Mortgage paid off ~${projection.mortgagePayoffYear}`
              : "No active mortgage linked"}
          </span>
        </Card>

        <Card className="glass">
          <span className="text-xs text-muted">Estimated FI Target Year</span>
          <h2 style={{ margin: "0.35rem 0", fontSize: "1.6rem", color: "#fbbf24" }}>
            {projection.fiTargetYearAccelerated ?? `>${new Date().getFullYear() + years}`}
          </h2>
          <span className="text-xs text-muted">Target: {fmtCompact(fiTarget)}</span>
        </Card>
      </div>

      {/* Interactive Controls */}
      <Card className="glass">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.85rem" }}>
            <span className="text-muted">Monthly Contribution: <strong>${monthlyContribution.toLocaleString()}</strong></span>
            <input
              type="range"
              min={0}
              max={10000}
              step={100}
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(Number(e.target.value))}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.85rem" }}>
            <span className="text-muted">Real Annual Return: <strong>{annualReturnPct.toFixed(1)}%</strong></span>
            <input
              type="range"
              min={3}
              max={12}
              step={0.5}
              value={annualReturnPct}
              onChange={(e) => setAnnualReturnPct(Number(e.target.value))}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.85rem" }}>
            <span className="text-muted">Horizon: <strong>{years} Years</strong></span>
            <input
              type="range"
              min={5}
              max={35}
              step={1}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.85rem" }}>
            <span className="text-muted">FI Target ($):</span>
            <input
              type="number"
              min={100000}
              step={50000}
              value={fiTarget}
              onChange={(e) => setFiTarget(Math.max(0, Number(e.target.value) || 0))}
              style={{ padding: "0.35rem 0.5rem", borderRadius: "6px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.15)", color: "inherit" }}
            />
          </label>
        </div>

        {initialData.mortgage && (
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "1rem", fontSize: "0.85rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={redirectMortgage}
              onChange={(e) => setRedirectMortgage(e.target.checked)}
            />
            <span>
              Redirect ${Math.round(initialData.mortgage.monthlyPayment).toLocaleString()}/mo mortgage payment into investments after payoff
            </span>
          </label>
        )}
      </Card>

      {/* Chart */}
      <Card className="glass">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <h3 style={{ margin: 0 }}>Projected Portfolio Growth</h3>
          <div style={{ display: "flex", gap: "1rem", fontSize: "0.78rem" }}>
            <span style={{ color: "#34d399" }}>● With Post-Mortgage Investing</span>
            <span style={{ color: "#60a5fa" }}>● Baseline</span>
            <span style={{ color: "#fbbf24" }}>--- FI Target</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
          <line x1={padL} y1={targetY} x2={width - padR} y2={targetY} stroke="#fbbf24" strokeDasharray="6 4" strokeWidth="1.5" />
          <text x={padL - 8} y={padT + 6} textAnchor="end" fill="#9ca3af" fontSize="11">{fmtCompact(maxVal)}</text>
          <text x={padL - 8} y={height - padB} textAnchor="end" fill="#9ca3af" fontSize="11">$0</text>
          <path d={basePath} fill="none" stroke="#60a5fa" strokeWidth="2.5" />
          {redirectMortgage && initialData.mortgage && (
            <path d={accelPath} fill="none" stroke="#34d399" strokeWidth="2.5" />
          )}
          {pts
            .filter((_, i) => i === 0 || i === pts.length - 1 || i % Math.max(1, Math.floor(pts.length / 6)) === 0)
            .map((p, idx) => {
              const c = toCoords(p.baseline, pts.indexOf(p));
              return (
                <text key={`${p.calendarYear}-${idx}`} x={c.x} y={height - 10} textAnchor="middle" fill="#9ca3af" fontSize="11">
                  {p.calendarYear}
                </text>
              );
            })}
        </svg>
      </Card>
    </div>
  );
}
