"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import { useNotification } from "@/components/ui/NotificationProvider";
import type { HistoricalYearSummary } from "@/lib/services/yearService";
import { deleteHistoricalYearAction } from "./actions";

interface HistoricalArchivesListProps {
  initialYears: HistoricalYearSummary[];
}

export default function HistoricalArchivesList({
  initialYears,
}: HistoricalArchivesListProps) {
  const router = useRouter();
  const { showToast } = useNotification();
  const [years, setYears] = useState<HistoricalYearSummary[]>(initialYears);
  const [deleteTarget, setDeleteTarget] = useState<HistoricalYearSummary | null>(null);
  const [cleanupArchived, setCleanupArchived] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteHistoricalYearAction(deleteTarget.year, cleanupArchived);
      setYears((prev) => prev.filter((y) => y.year !== deleteTarget.year));
      const cleanedNote =
        res.archivedCategoriesCleaned > 0
          ? ` and cleaned up ${res.archivedCategoriesCleaned} empty archived categor${res.archivedCategoriesCleaned === 1 ? "y" : "ies"}`
          : "";
      showToast(
        `Removed ${res.year} archive (${res.transactionsDeleted} transactions deleted${cleanedNote}).`,
        "success"
      );
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete historical year",
        "error"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (years.length === 0) {
    return (
      <div className="archive-empty-state">
        <p className="text-muted">
          No historical archives yet. Import a past year&apos;s spreadsheet below or close out a year to see archives here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="archive-year-list">
        {years.map((item) => (
          <div key={item.id} className="archive-year-row">
            <div className="archive-year-info">
              <div className="archive-year-heading">
                <span className="archive-year-badge">📅 {item.year}</span>
                <span className="archive-year-title">{item.year} Budget</span>
              </div>
              <div className="archive-year-stats">
                <span>
                  <strong>{item.transactionCount.toLocaleString()}</strong> transactions
                </span>
                <span className="archive-stat-sep">·</span>
                <span>
                  <strong>{item.categoryCount}</strong> categories
                </span>
                <span className="archive-stat-sep">·</span>
                <span>
                  <strong>
                    ${item.totalSpent.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </strong>{" "}
                  spent
                </span>
              </div>
            </div>

            <div className="archive-year-actions">
              <Link href={`/history/${item.year}`} className="archive-view-btn">
                View Budget →
              </Link>
              <button
                type="button"
                className="archive-delete-btn"
                onClick={() => {
                  setCleanupArchived(true);
                  setDeleteTarget(item);
                }}
                title={`Delete ${item.year} archive`}
                aria-label={`Delete ${item.year} archive`}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {deleteTarget && (
        <div
          className="cat-modal-overlay"
          onClick={() => !isDeleting && setDeleteTarget(null)}
        >
          <div className="cat-modal glass" onClick={(e) => e.stopPropagation()}>
            <h3>Delete {deleteTarget.year} Archive?</h3>
            <p className="text-muted" style={{ fontSize: "0.9rem", marginBottom: "1rem" }}>
              This will permanently remove the <strong>{deleteTarget.year}</strong> budget year, its{" "}
              <strong>{deleteTarget.categoryCount}</strong> yearly category configurations, and all{" "}
              <strong>{deleteTarget.transactionCount.toLocaleString()}</strong> transactions dated in{" "}
              <strong>{deleteTarget.year}</strong>.
            </p>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.85rem",
                color: "var(--text-main)",
                marginBottom: "1.25rem",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={cleanupArchived}
                onChange={(e) => setCleanupArchived(e.target.checked)}
                disabled={isDeleting}
              />
              Also remove archived categories left with 0 transactions
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.65rem" }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <button
                type="button"
                className="archive-delete-confirm-btn"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : `Delete ${deleteTarget.year}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
