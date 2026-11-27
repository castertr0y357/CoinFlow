"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useNotification } from "@/components/ui/NotificationProvider";

interface Mapping {
  sheetName: string;
  isTransactionSheet: boolean;
  headerRowIndex: number;
  headers: string[];
  suggestedCategory: string;
  dateColumn: string;
  payeeColumn: string;
  memoColumn: string;
  amountColumn: string;
  estimatedTransactionCount: number;
  skippedBudgetRowCount: number;
  detectedRollover: number | null;
  detectedMonthlyProvision: number | null;
}

interface ImportResults {
  transactionsCreated: number;
  transactionsSkippedDuplicate?: number;
  budgetRowsSkipped?: number;
  categoriesCreated: number;
  errors?: string[];
}

export default function HistoricalImporter() {
  const router = useRouter();
  const { showToast } = useNotification();
  const currentYear = new Date().getFullYear();
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(currentYear - 1);
  const [step, setStep] = useState(1); // 1: Upload, 2: Mapping, 3: Success
  const [isProcessing, setIsProcessing] = useState(false);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [skipBudgetRows, setSkipBudgetRows] = useState(false);
  const [applyRolloverAndBudget, setApplyRolloverAndBudget] = useState(true);
  const [archiveNewCategories, setArchiveNewCategories] = useState(true);
  const [replaceExistingYear, setReplaceExistingYear] = useState(false);
  const [results, setResults] = useState<ImportResults | null>(null);

  const isPastYear = year < currentYear;

  useEffect(() => {
    setSkipBudgetRows(!isPastYear);
    setArchiveNewCategories(isPastYear);
    if (!isPastYear) setReplaceExistingYear(false);
  }, [isPastYear]);

  useEffect(() => {
    const onReimport = (e: Event) => {
      const targetYear = (e as CustomEvent<{ year: number }>).detail?.year;
      if (typeof targetYear === "number" && !isNaN(targetYear)) {
        setYear(targetYear);
        setReplaceExistingYear(true);
        setStep(1);
        setFile(null);
        setResults(null);
        showToast(
          `Ready to re-import ${targetYear}. Choose your spreadsheet below — existing ${targetYear} data will be replaced.`,
          "info"
        );
      }
    };
    window.addEventListener("coinflow:reimport-year", onReimport);
    return () => window.removeEventListener("coinflow:reimport-year", onReimport);
  }, [showToast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("phase", "analyze");

      const res = await fetch("/api/v1/import/historical", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.suggestions) {
        setMappings(data.suggestions);
        setExistingCategories(data.existingCategories || []);
        setStep(2);
      } else {
        showToast(data.error || "Failed to analyze spreadsheet structure.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error analyzing file.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("phase", "execute");
      formData.append("year", year.toString());
      formData.append("mappings", JSON.stringify(mappings));
      formData.append(
        "options",
        JSON.stringify({
          skipBudgetRows,
          applyRolloverAndBudget,
          archiveNewCategories,
          replaceExistingYear: isPastYear && replaceExistingYear,
        })
      );

      const res = await fetch("/api/v1/import/historical", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Import failed.", "error");
        return;
      }
      setResults(data);
      setStep(3);
      router.refresh();
    } catch (err) {
      console.error(err);
      showToast("Import failed.", "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateMapping = (index: number, field: keyof Mapping, value: string | boolean) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value } as Mapping;
    setMappings(newMappings);
  };

  const selectedCount = mappings.filter((m) => m.isTransactionSheet).length;
  const totalEstTx = mappings
    .filter((m) => m.isTransactionSheet)
    .reduce((sum, m) => sum + (m.estimatedTransactionCount || 0), 0);

  return (
    <div className="historical-importer">
      {step === 1 && (
        <div className="step-upload animate-fade-in">
          <div className="importer-grid">
            <div className="form-group">
              <label htmlFor="historical-target-year">Target Year for Historical Data</label>
              <input
                id="historical-target-year"
                type="number"
                value={year}
                onChange={e => setYear(parseInt(e.target.value))}
                className="settings-input"
              />
              <p className="help-text">
                Select the calendar year this spreadsheet belongs to.
              </p>
            </div>

            <div className="form-group">
              <label>Spreadsheet File (.xlsx / .csv)</label>
              <label htmlFor="xlsx-upload" className="upload-zone glass">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  id="xlsx-upload"
                  style={{ display: "none" }}
                />
                <span className="upload-icon">📊</span>
                <span className="upload-label">
                  {file ? file.name : "Choose XLSX or CSV Spreadsheet..."}
                </span>
              </label>
              <p className="help-text">
                Automatically detects header rows, columns, rollovers, and monthly provisions.
              </p>
            </div>
          </div>

          {file && (
            <div className="mt-4 flex justify-end">
              <Button
                variant="primary"
                onClick={handleAnalyze}
                disabled={isProcessing}
              >
                {isProcessing ? "Analyzing Spreadsheet..." : "Analyze Spreadsheet 🔍"}
              </Button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="step-mapping animate-fade-in">
          <div className="mapping-header">
            <div>
              <h3>Review Sheet Mappings for {year}</h3>
              <p className="text-muted text-sm">
                {selectedCount} of {mappings.length} sheets selected (~{totalEstTx} transactions)
              </p>
            </div>
            <div className="mapping-toggles">
              <label className="toggle-option">
                <input
                  type="checkbox"
                  checked={skipBudgetRows}
                  onChange={(e) => setSkipBudgetRows(e.target.checked)}
                />
                <span>Skip internal rows (Year Start, Monthly Additions, Boost, Adjustment)</span>
              </label>
              <label className="toggle-option">
                <input
                  type="checkbox"
                  checked={applyRolloverAndBudget}
                  onChange={(e) => setApplyRolloverAndBudget(e.target.checked)}
                />
                <span>Import Year Start as Rollover &amp; Monthly Provision as Monthly Budget</span>
              </label>
              <label className="toggle-option">
                <input
                  type="checkbox"
                  checked={archiveNewCategories}
                  onChange={(e) => setArchiveNewCategories(e.target.checked)}
                />
                <span>Archive newly created categories (keeps past-year categories out of current budget)</span>
              </label>
              {isPastYear && (
                <label className="toggle-option">
                  <input
                    type="checkbox"
                    checked={replaceExistingYear}
                    onChange={(e) => setReplaceExistingYear(e.target.checked)}
                  />
                  <span>Replace existing {year} data before importing (clean re-import)</span>
                </label>
              )}
            </div>
          </div>

          <div className="mapping-list">
            {mappings.map((m, i) => {
              const categoryOptions = existingCategories.includes(m.suggestedCategory)
                ? existingCategories
                : [m.suggestedCategory, ...existingCategories];

              return (
                <Card key={m.sheetName} className={`mapping-item glass ${!m.isTransactionSheet ? "skipped-sheet" : ""}`}>
                  <div className="sheet-row-header">
                    <label className="sheet-checkbox">
                      <input
                        type="checkbox"
                        checked={m.isTransactionSheet}
                        disabled={m.headers.length === 0}
                        onChange={(e) => updateMapping(i, "isTransactionSheet", e.target.checked)}
                      />
                      <strong>{m.sheetName}</strong>
                    </label>
                    <div className="sheet-badges">
                      {m.headers.length === 0 ? (
                        <span className="sheet-badge muted">Summary / No table</span>
                      ) : (
                        <>
                          <span className="sheet-badge primary">{m.estimatedTransactionCount} tx</span>
                          {m.detectedMonthlyProvision !== null && (
                            <span className="sheet-badge accent">Budget: ${m.detectedMonthlyProvision}/mo</span>
                          )}
                          {m.detectedRollover !== null && m.detectedRollover !== 0 && (
                            <span className="sheet-badge muted">Rollover: ${m.detectedRollover}</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {m.isTransactionSheet && (
                    <div className="mapping-cols-grid">
                      <div className="form-group">
                        <label className="col-label">Target Category</label>
                        <select
                          value={m.suggestedCategory}
                          onChange={(e) => updateMapping(i, "suggestedCategory", e.target.value)}
                          className="col-select"
                        >
                          {categoryOptions.map((cat) => (
                            <option key={cat} value={cat}>
                              {existingCategories.includes(cat) ? cat : `+ Create "${cat}"`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="col-label">Date Column</label>
                        <select
                          value={m.dateColumn}
                          onChange={(e) => updateMapping(i, "dateColumn", e.target.value)}
                          className="col-select"
                        >
                          {m.headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="col-label">Payee / Store</label>
                        <select
                          value={m.payeeColumn}
                          onChange={(e) => updateMapping(i, "payeeColumn", e.target.value)}
                          className="col-select"
                        >
                          {m.headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="col-label">Memo (Optional)</label>
                        <select
                          value={m.memoColumn}
                          onChange={(e) => updateMapping(i, "memoColumn", e.target.value)}
                          className="col-select"
                        >
                          <option value="">(None)</option>
                          {m.headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="col-label">Amount Column</label>
                        <select
                          value={m.amountColumn}
                          onChange={(e) => updateMapping(i, "amountColumn", e.target.value)}
                          className="col-select"
                        >
                          {m.headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <div className="actions mt-6 flex gap-4">
            <Button variant="primary" onClick={handleImport} disabled={isProcessing || selectedCount === 0} className="flex-1">
              {isProcessing ? "Importing Data..." : `Execute Import (${selectedCount} sheets) 🚀`}
            </Button>
            <Button variant="ghost" onClick={() => setStep(1)} disabled={isProcessing}>Back</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="step-success animate-fade-in text-center p-8">
          <div className="text-6xl mb-4">✅</div>
          <h2>Import Complete!</h2>
          <div className="stats glass p-4 mt-4 inline-block text-left">
            <p>Year: <strong>{year}</strong></p>
            <p>Transactions Created: <strong>{results?.transactionsCreated ?? 0}</strong></p>
            {!!results?.transactionsSkippedDuplicate && (
              <p>Duplicates Skipped: <strong>{results.transactionsSkippedDuplicate}</strong></p>
            )}
            {!!results?.budgetRowsSkipped && (
              <p>Internal Budget Rows Skipped: <strong>{results.budgetRowsSkipped}</strong></p>
            )}
            <p>New Categories Created: <strong>{results?.categoriesCreated ?? 0}</strong></p>
          </div>
          <div className="mt-6">
            <Button variant="primary" onClick={() => window.location.href = `/history/${year}`}>
              View {year} History 📈
            </Button>
            <Button variant="ghost" onClick={() => setStep(1)} className="ml-2">Done</Button>
          </div>
        </div>
      )}

      <style jsx>{`
        .historical-importer {
          margin-top: 0.5rem;
        }
        .importer-grid {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 1.5rem;
          align-items: start;
        }
        @media (max-width: 768px) {
          .importer-grid {
            grid-template-columns: 1fr;
          }
        }
        .upload-zone {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.85rem 1.25rem;
          border: 1px dashed var(--glass-border);
          color: var(--text-dim);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: rgba(0, 0, 0, 0.25);
        }
        .upload-zone:hover {
          border-color: var(--primary);
          background: rgba(99, 102, 241, 0.08);
          color: var(--text-main);
        }
        .upload-icon {
          font-size: 1.25rem;
          line-height: 1;
        }
        .upload-label {
          font-size: 0.95rem;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .settings-input {
          width: 100%;
          padding: 0.85rem 1.25rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--glass-border);
          border-radius: 10px;
          color: var(--text-main);
          font-size: 1rem;
        }
        .mapping-header {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }
        .mapping-toggles {
          display: flex;
          flex-wrap: wrap;
          gap: 1.25rem;
          padding: 0.85rem 1rem;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
        }
        .toggle-option {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-dim);
          cursor: pointer;
        }
        .mapping-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-height: 520px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .mapping-item {
          padding: 0.9rem 1.1rem !important;
        }
        .mapping-item.skipped-sheet {
          opacity: 0.6;
        }
        .sheet-row-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .sheet-checkbox {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          cursor: pointer;
          font-size: 0.95rem;
        }
        .sheet-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }
        .sheet-badge {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 999px;
        }
        .sheet-badge.primary {
          background: rgba(99, 102, 241, 0.16);
          color: var(--primary);
        }
        .sheet-badge.accent {
          background: rgba(16, 185, 129, 0.15);
          color: var(--accent);
        }
        .sheet-badge.muted {
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-muted);
        }
        .mapping-cols-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.75rem;
          margin-top: 0.85rem;
          padding-top: 0.85rem;
          border-top: 1px solid var(--glass-border);
        }
        @media (max-width: 992px) {
          .mapping-cols-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        .col-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
        }
        .col-select {
          width: 100%;
          padding: 0.45rem 0.65rem;
          border-radius: 8px;
          border: 1px solid var(--glass-border);
          background: rgba(0, 0, 0, 0.35);
          color: var(--text-main);
          font-size: 0.82rem;
        }
      `}</style>
    </div>
  );
}
