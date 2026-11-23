"use client";

import { useState, useMemo } from "react";
import Card from "@/components/ui/Card";
import { buildCashFlowTimeline, CashFlowCommitmentInput } from "@/lib/services/planningService";

interface CashFlowClientProps {
  initialData: {
    startingCash: number;
    creditCardBalance: number;
    liquidAccounts: { id: string; name: string; balance: number }[];
    paycheckEnabled: boolean;
    paycheckAmount: number;
    paycheckFrequency: string;
    paycheckNextDate: string | null;
    monthlyIncome: number;
    commitments: CashFlowCommitmentInput[];
  };
}

export default function CashFlowClient({ initialData }: CashFlowClientProps) {
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(60);
  const [safetyBuffer, setSafetyBuffer] = useState<number>(1000);
  const [includeCreditCards, setIncludeCreditCards] = useState<boolean>(true);
  const [cardAutopayDay, setCardAutopayDay] = useState<number>(15);

  const timeline = useMemo(() => {
    return buildCashFlowTimeline({
      startDate: new Date(),
      horizonDays,
      startingCash: initialData.startingCash,
      safetyBuffer,
      includeCreditCards,
      creditCardBalance: initialData.creditCardBalance,
      cardAutopayDay,
      paycheckEnabled: initialData.paycheckEnabled,
      paycheckAmount: initialData.paycheckAmount,
      paycheckFrequency: initialData.paycheckFrequency,
      paycheckNextDate: initialData.paycheckNextDate,
      monthlyIncome: initialData.monthlyIncome,
      commitments: initialData.commitments,
    });
  }, [initialData, horizonDays, safetyBuffer, includeCreditCards, cardAutopayDay]);

  // SVG chart geometry
  const pts = timeline.points;
  const vals = pts.map((p) => p.balance);
  const minVal = Math.min(...vals, safetyBuffer, 0);
  const maxVal = Math.max(...vals, safetyBuffer + 500, 1000);
  const range = maxVal - minVal || 1;
  const width = 820;
  const height = 250;
  const padL = 70;
  const padR = 25;
  const padT = 25;
  const padB = 35;
  const cw = width - padL - padR;
  const ch = height - padT - padB;

  const coords = pts.map((p, i) => ({
    x: padL + (i / Math.max(1, pts.length - 1)) * cw,
    y: height - padB - ((p.balance - minVal) / range) * ch,
    ...p,
  }));

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const areaPath =
    `M ${coords[0].x} ${height - padB} ` +
    coords.map((c) => `L ${c.x} ${c.y}`).join(" ") +
    ` L ${coords[coords.length - 1].x} ${height - padB} Z`;
  const bufferY = height - padB - ((safetyBuffer - minVal) / range) * ch;

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "1rem" }}>
        <Card className="glass">
          <span className="text-xs text-muted">On-Budget Liquid Cash</span>
          <h2 style={{ margin: "0.35rem 0", fontSize: "1.6rem" }}>${fmt(timeline.startingCash)}</h2>
          <span className="text-xs text-muted">{initialData.liquidAccounts.length} active checking/cash account(s)</span>
        </Card>

        <Card className="glass" style={{ borderColor: timeline.safeToSweep > 0 ? "rgba(16, 185, 129, 0.4)" : undefined }}>
          <span className="text-xs text-muted">Safe to Sweep Now</span>
          <h2 style={{ margin: "0.35rem 0", fontSize: "1.6rem", color: "#34d399" }}>${fmt(timeline.safeToSweep)}</h2>
          <span className="text-xs text-muted">Above ${safetyBuffer.toLocaleString()} safety buffer</span>
        </Card>

        <Card className="glass">
          <span className="text-xs text-muted">Lowest Projected Balance</span>
          <h2
            style={{
              margin: "0.35rem 0",
              fontSize: "1.6rem",
              color: timeline.lowestBalance < safetyBuffer ? "#f87171" : "#60a5fa",
            }}
          >
            ${fmt(timeline.lowestBalance)}
          </h2>
          <span className="text-xs text-muted">Occurs on {timeline.lowestDate}</span>
        </Card>

        <Card className="glass">
          <span className="text-xs text-muted">{horizonDays}-Day Ending Balance</span>
          <h2 style={{ margin: "0.35rem 0", fontSize: "1.6rem" }}>${fmt(timeline.endingBalance)}</h2>
          <span className="text-xs text-muted">{timeline.events.length} scheduled events</span>
        </Card>
      </div>

      {/* Controls */}
      <Card className="glass">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <span className="text-xs text-muted">Horizon:</span>
            {([30, 60, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setHorizonDays(d)}
                className={`btn btn-sm ${horizonDays === d ? "btn-primary" : "btn-secondary"}`}
              >
                {d} Days
              </button>
            ))}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
            <span className="text-muted">Safety Buffer ($):</span>
            <input
              type="number"
              min={0}
              step={250}
              value={safetyBuffer}
              onChange={(e) => setSafetyBuffer(Math.max(0, Number(e.target.value) || 0))}
              style={{ width: "100px", padding: "0.35rem 0.5rem", borderRadius: "6px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.15)", color: "inherit" }}
            />
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={includeCreditCards}
              onChange={(e) => setIncludeCreditCards(e.target.checked)}
            />
            <span>Include Card Payoffs (${fmt(initialData.creditCardBalance)})</span>
          </label>

          {includeCreditCards && initialData.creditCardBalance > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
              <span className="text-muted">Card Autopay Day:</span>
              <input
                type="number"
                min={1}
                max={28}
                value={cardAutopayDay}
                onChange={(e) => setCardAutopayDay(Math.min(28, Math.max(1, Number(e.target.value) || 15)))}
                style={{ width: "64px", padding: "0.35rem 0.5rem", borderRadius: "6px", background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.15)", color: "inherit" }}
              />
            </label>
          )}
        </div>
      </Card>

      {/* Chart */}
      <Card className="glass">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
          <h3 style={{ margin: 0 }}>Projected Checking Balance ({horizonDays} Days)</h3>
          <span className="text-xs text-muted">Dashed line = ${safetyBuffer.toLocaleString()} safety buffer</span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
          <defs>
            <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <line x1={padL} y1={bufferY} x2={width - padR} y2={bufferY} stroke="#f59e0b" strokeDasharray="6 4" strokeWidth="1.5" />
          <text x={padL - 8} y={padT + 6} textAnchor="end" fill="#9ca3af" fontSize="11">${Math.round(maxVal).toLocaleString()}</text>
          <text x={padL - 8} y={height - padB} textAnchor="end" fill="#9ca3af" fontSize="11">${Math.round(minVal).toLocaleString()}</text>
          <path d={areaPath} fill="url(#cfGrad)" />
          <path d={linePath} fill="none" stroke="#60a5fa" strokeWidth="2.5" />
          {coords
            .filter((_, i) => i === 0 || i === coords.length - 1 || i % Math.max(1, Math.floor(coords.length / 6)) === 0)
            .map((c) => (
              <text key={c.dateKey} x={c.x} y={height - 10} textAnchor="middle" fill="#9ca3af" fontSize="11">
                {c.dateLabel}
              </text>
            ))}
        </svg>
      </Card>

      {/* Events List */}
      <Card className="glass">
        <h3 style={{ marginBottom: "0.75rem" }}>Upcoming Scheduled Events</h3>
        {timeline.events.length === 0 ? (
          <p className="text-muted text-sm">No paychecks or commitments scheduled in this window. Configure Paycheck Forecasting in Settings or add Commitments.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem" }}>Date</th>
                  <th style={{ padding: "0.5rem" }}>Event</th>
                  <th style={{ padding: "0.5rem" }}>Type</th>
                  <th style={{ padding: "0.5rem", textAlign: "right" }}>Amount</th>
                  <th style={{ padding: "0.5rem", textAlign: "right" }}>Projected Balance</th>
                </tr>
              </thead>
              <tbody>
                {timeline.events.map((ev, idx) => (
                  <tr key={`${ev.dateKey}-${idx}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "0.5rem" }}>{ev.dateLabel}</td>
                    <td style={{ padding: "0.5rem" }}>{ev.name}</td>
                    <td style={{ padding: "0.5rem", textTransform: "capitalize" }} className="text-muted">{ev.type}</td>
                    <td style={{ padding: "0.5rem", textAlign: "right", color: ev.amount >= 0 ? "#34d399" : "#f87171", fontWeight: 600 }}>
                      {ev.amount >= 0 ? `+$${fmt(ev.amount)}` : `-$${fmt(Math.abs(ev.amount))}`}
                    </td>
                    <td style={{ padding: "0.5rem", textAlign: "right" }}>${fmt(ev.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
