"use client";

import Link from "next/link";
import { useBudget } from "@/hooks/useBudget";
import Card from "@/components/ui/Card";
import CategorySpreadsheet from "@/components/dashboard/CategorySpreadsheet";
import "@/app/Dashboard.css";
import "./History.css";

interface HistoryClientProps {
  year: number;
  availableYears: number[];
}

function formatCurrency(val: number): string {
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return val < 0 ? `-$${formatted}` : `$${formatted}`;
}

export default function HistoryClient({ year, availableYears }: HistoryClientProps) {
  const { tally, isLoading, isError, refresh } = useBudget(year);

  if (isError || (tally && tally.error)) {
    return (
      <div className="history-container">
        <Card className="glass" style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Unable to load {year} archive</h2>
          <p className="text-muted">
            {isError?.message || tally?.error || "We couldn't load the historical budget data."}
          </p>
          <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem", justifyContent: "center" }}>
            <button onClick={() => window.location.reload()} className="btn btn-primary">
              Retry
            </button>
            <Link href="/" className="history-year-pill">
              ← Back to Dashboard
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (isLoading || !tally || typeof tally !== "object" || !tally.year) {
    return (
      <div className="history-container">
        <div className="glass skeleton animate-fade-in" style={{ minHeight: "360px", borderRadius: "16px" }} />
      </div>
    );
  }

  const categories = tally.categories || [];
  const incomeCategory = categories.find(
    (c: { name: string }) => c.name === "Historical Income"
  );
  const budgetCategories = categories.filter(
    (c: { name: string }) => c.name !== "Historical Income"
  );

  const totalIncome = incomeCategory ? Number(incomeCategory.provisions ?? 0) : 0;
  const totalBudgeted = budgetCategories.reduce(
    (sum: number, c: { budget?: number; provisions?: number; rollover?: number }) =>
      sum + Number(c.provisions ?? c.budget ?? 0) + Number(c.rollover ?? 0),
    0
  );
  const totalSpent = budgetCategories.reduce(
    (sum: number, c: { totalSpent?: number; spent?: number }) =>
      sum + Math.abs(Number(c.totalSpent ?? c.spent ?? 0)),
    0
  );
  const totalRemaining = budgetCategories.reduce(
    (sum: number, c: { remaining?: number }) => sum + Number(c.remaining ?? 0),
    0
  );

  return (
    <div className="history-container animate-fade-in">
      <header className="history-header">
        <div className="history-title-group">
          <span className="history-badge">📅 Historical Archive</span>
          <h1>{year} Budget Overview</h1>
          <p className="text-dim">
            Finalized category totals and spending for {year}, including archived categories from that year.
          </p>
        </div>

        <div className="history-header-actions">
          {availableYears.length > 1 && (
            <div className="history-year-pills" aria-label="Switch archive year">
              {availableYears.map((y) => (
                <Link
                  key={y}
                  href={`/history/${y}`}
                  className={`history-year-pill${y === year ? " active" : ""}`}
                >
                  {y}
                </Link>
              ))}
            </div>
          )}
          <Link href="/transactions" className="history-year-pill">
            🔍 Search All Transactions
          </Link>
          <Link href="/" className="history-year-pill">
            ← Current Dashboard
          </Link>
        </div>
      </header>

      <div className="history-summary-grid">
        <Card className="history-stat-card glass">
          <span className="history-stat-label">Total Budgeted</span>
          <span className="history-stat-value">{formatCurrency(totalBudgeted)}</span>
          <span className="history-stat-sub">Provisions + rollover for {year}</span>
        </Card>

        <Card className="history-stat-card glass">
          <span className="history-stat-label">Total Spent</span>
          <span className="history-stat-value">{formatCurrency(totalSpent)}</span>
          <span className="history-stat-sub">Across {categories.length} categories</span>
        </Card>

        <Card className="history-stat-card glass">
          <span className="history-stat-label">Ending Balance</span>
          <span className={`history-stat-value ${totalRemaining >= 0 ? "positive" : "negative"}`}>
            {formatCurrency(totalRemaining)}
          </span>
          <span className="history-stat-sub">Net remaining at year end</span>
        </Card>

        <Card className="history-stat-card glass">
          <span className="history-stat-label">
            {totalIncome > 0 ? "Total Income" : "Categories"}
          </span>
          <span className={`history-stat-value ${totalIncome > 0 ? "positive" : ""}`}>
            {totalIncome > 0 ? formatCurrency(totalIncome) : categories.length}
          </span>
          <span className="history-stat-sub">
            {totalIncome > 0
              ? `Recorded income in ${year} · ${budgetCategories.length} categories`
              : `Active & archived in ${year}`}
          </span>
        </Card>
      </div>

      <div className="dashboard-spreadsheet-section">
        <CategorySpreadsheet
          categories={categories}
          integrityWarnings={tally.integrityWarnings || []}
          onRefresh={refresh}
          isHistorical={true}
        />
      </div>
    </div>
  );
}
