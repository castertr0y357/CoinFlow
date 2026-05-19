"use client";

import { useBudget } from "@/hooks/useBudget";
import TallyOverview from "./TallyOverview";
import CashHealth from "./CashHealth";
import CategorySpreadsheet from "./CategorySpreadsheet";

import ForecastCard from "./ForecastCard";
import GoalsSummaryCard from "./GoalsSummaryCard";

import { formatDistanceToNow } from 'date-fns';

export default function DashboardClient({ year }: { year?: number }) {
  const { tally, isLoading: budgetLoading, isError: budgetError, refresh: refreshBudget } = useBudget(year);

  if (budgetError || (tally && tally.error)) {
    return (
      <div className="error-container glass animate-fade-in" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Dashboard unavailable</h2>
        <p>{budgetError?.message || tally?.error || "We couldn't load your financial data."}</p>
        <button onClick={() => window.location.reload()} className="btn btn-primary mt-4">Retry</button>
      </div>
    );
  }

  // Ensure tally has data before rendering
  if (budgetLoading || !tally || typeof tally !== 'object' || !tally.year) {
    return null;
  }

  return (
    <div className="dashboard-layout-content animate-fade-in">
      {tally.lastSync && (
        <div className="text-right text-xs text-muted mb-2 animate-fade-in" style={{ opacity: 0.7 }}>
          🔄 Last synced: {formatDistanceToNow(new Date(tally.lastSync), { addSuffix: true })}
        </div>
      )}
      <div className="budget-status-header">
        <CashHealth 
          liquidCash={tally.liquidCash}
          creditDebt={tally.creditDebt}
          totalObligations={tally.totalObligations}
          finalSurplus={tally.finalSurplus}
        />
        <ForecastCard 
          expectedIncome={tally.forecast?.expectedIncome || 0}
          projectedMonthEnd={tally.forecast?.projectedMonthEnd || 0}
          isHealthy={tally.forecast?.isHealthy || false}
          paycheckEnabled={tally.forecast?.paycheckEnabled || false}
          paychecks={tally.forecast?.paychecks || []}
          remainingIncome={tally.forecast?.remainingIncome || 0}
          nextMonthAllocations={tally.forecast?.nextMonthAllocations || 0}
          nextMonthCommitments={tally.forecast?.nextMonthCommitments || 0}
          nextMonthSurplus={tally.forecast?.nextMonthSurplus || 0}
        />
        <GoalsSummaryCard />
      </div>

      <div className="dashboard-spreadsheet-section mt-8">
        <CategorySpreadsheet 
          categories={tally?.categories || []} 
          integrityWarnings={tally?.integrityWarnings || []}
          onRefresh={refreshBudget} 
        />
      </div>
      <style jsx>{`
        .budget-status-header {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1.5rem;
        }
        @media (max-width: 1100px) {
          .budget-status-header {
            grid-template-columns: 1fr;
          }
        }
        .dashboard-spreadsheet-section {
          margin-bottom: 2rem;
        }
      `}</style>
    </div>
  );
}
