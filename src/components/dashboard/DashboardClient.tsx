"use client";

import { useState } from "react";
import { mutate } from "swr";
import { useBudget } from "@/hooks/useBudget";
import { updateAccountSettings } from "@/app/categories/actions";
import CashHealth from "./CashHealth";
import CategorySpreadsheet from "./CategorySpreadsheet";
import Link from "next/link";
import Button from "@/components/ui/Button";
import AddTransactionModal from "@/components/transactions/AddTransactionModal";

import ForecastCard from "./ForecastCard";
import GoalsSummaryCard from "./GoalsSummaryCard";

import { formatDistanceToNow } from 'date-fns';

export default function DashboardClient({ year }: { year?: number }) {
  const { tally, isLoading: budgetLoading, isError: budgetError, refresh: refreshBudget } = useBudget(year);
  const [showAddModal, setShowAddModal] = useState(false);

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

  const syncErrorAccounts = (tally.accounts || []).filter(
    (a: { syncError?: string | null; muteSyncErrors?: boolean }) => !!a.syncError && !a.muteSyncErrors
  );
  const [isSilencing, setIsSilencing] = useState(false);

  const handleSilenceAlerts = async () => {
    setIsSilencing(true);
    try {
      await Promise.all(
        syncErrorAccounts.map((a: { id: string }) =>
          updateAccountSettings(a.id, { muteSyncErrors: true })
        )
      );
      refreshBudget();
      mutate("/api/v1/budget/tally");
    } finally {
      setIsSilencing(false);
    }
  };

  return (
    <div className="dashboard-layout-content animate-fade-in">
      <header className="page-header-flex">
        <div>
          <h1>Dashboard</h1>
          <p className="text-dim">Overview of your liquid capital, commitments, and goals.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {tally.lastSync && (
            <div className="text-right text-xs text-muted animate-fade-in" style={{ opacity: 0.7 }}>
              🔄 Last synced: {formatDistanceToNow(new Date(tally.lastSync), { addSuffix: true })}
            </div>
          )}
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
            + Add Transaction
          </Button>
        </div>
      </header>

      {syncErrorAccounts.length > 0 && (
        <div
          className="glass animate-fade-in"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.85rem 1.25rem',
            marginBottom: '1.25rem',
            borderRadius: '12px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.88rem' }}>
            <span>⚠️</span>
            <span>
              <strong>Bank sync issue</strong> on {syncErrorAccounts.length} account{syncErrorAccounts.length > 1 ? 's' : ''}:{' '}
              {syncErrorAccounts.map((a: { displayName?: string | null; name: string; syncError?: string | null }) => `${a.displayName || a.name} (${a.syncError})`).join(' · ')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleSilenceAlerts}
              disabled={isSilencing}
              className="btn-inbox"
              style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#fca5a5', background: 'rgba(239, 68, 68, 0.12)', cursor: 'pointer' }}
              title="Silence alerts for these accounts until unmuted in Accounts"
            >
              {isSilencing ? 'Silencing...' : '🔕 Silence'}
            </button>
            <Link href="/accounts" className="btn-inbox" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)' }}>
              View Accounts &rarr;
            </Link>
          </div>
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
          projectedMonthEnd={tally.forecast?.projectedMonthEnd || 0}
          isHealthy={tally.forecast?.isHealthy || false}
          paycheckEnabled={tally.forecast?.paycheckEnabled || false}
          paychecks={tally.forecast?.paychecks || []}
          nextMonthAllocations={tally.forecast?.nextMonthAllocations || 0}
          nextMonthSurplus={tally.forecast?.nextMonthSurplus || 0}
        />
        <GoalsSummaryCard />
      </div>

      {tally.inbox && tally.inbox.count > 0 && (
        <div className="inbox-alert-banner glass animate-fade-in">
          <div className="inbox-banner-left">
            <span className="pulsing-dot" />
            <span className="inbox-banner-icon">📥</span>
            <span className="inbox-banner-message">
              You have <strong>{tally.inbox.count} transaction{tally.inbox.count > 1 ? 's' : ''}</strong> waiting in your Inbox (<strong>{tally.inbox.total < 0 ? '-' : ''}${Math.abs(tally.inbox.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> total).
            </span>
          </div>
          <Link href="/transactions" className="btn-inbox">
            Review Inbox &rarr;
          </Link>
        </div>
      )}

      <div className="dashboard-spreadsheet-section mt-8">
        <CategorySpreadsheet 
          categories={tally?.categories || []} 
          integrityWarnings={tally?.integrityWarnings || []}
          onRefresh={refreshBudget} 
        />
      </div>
      {showAddModal && (
        <AddTransactionModal
          categoryId={tally?.categories?.[0]?.id || ""}
          categoryName={tally?.categories?.[0]?.name || "General"}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            refreshBudget();
          }}
        />
      )}
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
        .inbox-alert-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          background: rgba(245, 158, 11, 0.05);
          border: 1px dashed rgba(245, 158, 11, 0.25);
          border-radius: 12px;
          margin-top: 1.75rem;
          gap: 1rem;
          transition: all 0.3s ease;
        }
        .inbox-alert-banner:hover {
          background: rgba(245, 158, 11, 0.08);
          border-color: rgba(245, 158, 11, 0.4);
          transform: translateY(-1px);
        }
        .inbox-banner-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .pulsing-dot {
          width: 8px;
          height: 8px;
          background: #f59e0b;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
          animation: inboxPulse 2s infinite;
        }
        @keyframes inboxPulse {
          0% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.7);
          }
          70% {
            transform: scale(1);
            box-shadow: 0 0 0 6px rgba(245, 158, 11, 0);
          }
          100% {
            transform: scale(0.95);
            box-shadow: 0 0 0 0 rgba(245, 158, 11, 0);
          }
        }
        .inbox-banner-icon {
          font-size: 1.2rem;
        }
        .inbox-banner-message {
          font-size: 0.9rem;
          color: var(--text-main);
        }
        .inbox-banner-message strong {
          color: white;
          font-weight: 700;
        }
        .btn-inbox {
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #f59e0b !important;
          font-weight: 700;
          font-size: 0.8rem;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          text-decoration: none;
          white-space: nowrap;
          transition: all 0.2s ease;
        }
        .btn-inbox:hover {
          background: #f59e0b;
          color: black !important;
          transform: scale(1.03);
          box-shadow: 0 0 12px rgba(245, 158, 11, 0.3);
        }
        @media (max-width: 650px) {
          .inbox-alert-banner {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
            padding: 1rem;
          }
          .btn-inbox {
            align-self: flex-end;
          }
        }
        .dashboard-spreadsheet-section {
          margin-bottom: 2rem;
        }
      `}</style>
    </div>
  );
}
