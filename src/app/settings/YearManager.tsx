"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useNotification } from "@/components/ui/NotificationProvider";
import {
  closeYearAndStartNext,
  getYearEndRolloverPreview,
  YearEndCategoryPreview,
} from "./actions";

export default function YearManager({ currentYear }: { currentYear: number }) {
  const { showToast } = useNotification();
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [nextYear, setNextYear] = useState<number | null>(null);
  const [preview, setPreview] = useState<YearEndCategoryPreview[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleOpenPreview = async () => {
    setIsLoadingPreview(true);
    try {
      const items = await getYearEndRolloverPreview();
      setPreview(items);
      // Default: check all categories with non-zero ending balances (both positive and negative)
      setSelectedIds(
        new Set(items.filter((i) => i.endingBalance !== 0).map((i) => i.categoryId))
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to load rollover preview",
        "error"
      );
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const toggleCategory = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmCloseYear = async () => {
    setIsProcessing(true);
    try {
      const year = await closeYearAndStartNext(Array.from(selectedIds));
      setNextYear(year);
      setPreview(null);
      showToast(
        `${year} Budget initialized with rollovers from ${currentYear}!`,
        "success"
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to close year",
        "error"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="year-manager">
      <div className="current-year-status">
        <span className="label">Active Container:</span>
        <span className="value">{currentYear}</span>
      </div>

      <p className="text-muted text-sm mb-4">
        Closing the year will lock in your historical data and let you choose which category surpluses or deficits carry forward into {currentYear + 1}.
      </p>

      <Button
        variant="glass"
        onClick={handleOpenPreview}
        disabled={isLoadingPreview || isProcessing}
        className="w-full"
      >
        {isLoadingPreview
          ? "Calculating Rollovers..."
          : `Review & Start ${currentYear + 1} Budget`}
      </Button>

      {nextYear && (
        <p className="text-success text-sm mt-2">
          ✓ {nextYear} is ready for provisioning.
        </p>
      )}

      {preview && (
        <div
          className="cat-modal-overlay"
          onClick={() => !isProcessing && setPreview(null)}
        >
          <div
            className="cat-modal glass"
            style={{ maxWidth: "540px", width: "92%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3>
              Carry Over Balances to {currentYear + 1}
            </h3>
            <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>
              Select which categories should carry their ending balance (positive or negative) into {currentYear + 1}. Unchecked categories start at $0.
            </p>

            <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedIds(
                    new Set(preview.filter((p) => p.endingBalance !== 0).map((p) => p.categoryId))
                  )
                }
              >
                All Non-Zero
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedIds(
                    new Set(preview.filter((p) => p.endingBalance > 0).map((p) => p.categoryId))
                  )
                }
              >
                Positive Only
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                None ($0)
              </Button>
            </div>

            <div
              style={{
                maxHeight: "300px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                marginBottom: "1.1rem",
                paddingRight: "0.25rem",
              }}
            >
              {preview.map((item) => {
                const checked = selectedIds.has(item.categoryId);
                return (
                  <label
                    key={item.categoryId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "0.45rem 0.65rem",
                      borderRadius: "8px",
                      background: checked
                        ? "rgba(99, 102, 241, 0.1)"
                        : "rgba(255, 255, 255, 0.02)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      cursor: "pointer",
                      fontSize: "0.86rem",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(item.categoryId)}
                        disabled={isProcessing}
                      />
                      <span>{item.name}</span>
                    </span>
                    <span
                      className="font-mono"
                      style={{
                        fontWeight: 600,
                        color:
                          item.endingBalance < 0
                            ? "#f87171"
                            : item.endingBalance > 0
                              ? "#34d399"
                              : "var(--text-muted)",
                      }}
                    >
                      {item.endingBalance < 0 ? "-" : ""}$
                      {Math.abs(item.endingBalance).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </label>
                );
              })}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.65rem" }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreview(null)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmCloseYear}
                disabled={isProcessing}
              >
                {isProcessing
                  ? "Initializing..."
                  : `Start ${currentYear + 1} Budget`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
