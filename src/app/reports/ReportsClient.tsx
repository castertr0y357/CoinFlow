"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useNotification } from "@/components/ui/NotificationProvider";
import { applySingleCategoryRollover, finalizeYearEndRollovers } from "./actions";
import "./Reports.css";

interface Category {
  id: string;
  name: string;
  budget: number;
  adjustment: number;
  rollover: number;
  totalSpent: number;
  currentBalance: number;
}

interface ReportsClientProps {
  availableYears: number[];
  selectedYear: number;
  initialCategories: Category[];
  aiEnabled: boolean;
}

export default function ReportsClient({ availableYears, selectedYear, initialCategories }: ReportsClientProps) {
  const router = useRouter();
  const { showToast, confirm } = useNotification();
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const handleRunAnalysis = () => {
    const totalBudget = initialCategories.reduce((sum, c) => sum + c.budget, 0);
    const totalSpent = initialCategories.reduce((sum, c) => sum + c.totalSpent, 0);
    const netDiff = totalBudget - totalSpent;

    const underBudget = [...initialCategories]
      .filter((c) => c.budget > 0 && c.totalSpent < c.budget)
      .sort((a, b) => (b.budget - b.totalSpent) - (a.budget - a.totalSpent))
      .slice(0, 3);

    const overBudget = [...initialCategories]
      .filter((c) => c.budget > 0 && c.totalSpent > c.budget)
      .sort((a, b) => (b.totalSpent - b.budget) - (a.totalSpent - a.budget))
      .slice(0, 3);

    const lines = [
      `## ${selectedYear} Financial Insights Summary`,
      ``,
      `- **Total Annual Budget**: $${totalBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      `- **Total Spent**: $${totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${netDiff >= 0 ? `+$${netDiff.toLocaleString(undefined, { maximumFractionDigits: 0 })} under budget` : `$${Math.abs(netDiff).toLocaleString(undefined, { maximumFractionDigits: 0 })} over budget`})`,
    ];

    if (underBudget.length > 0) {
      lines.push(``, `### Top Surpluses`);
      underBudget.forEach((c) => {
        const saved = c.budget - c.totalSpent;
        lines.push(`- **${c.name}**: Under budget by $${saved.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
      });
    }

    if (overBudget.length > 0) {
      lines.push(``, `### Over-Budget Categories`);
      overBudget.forEach((c) => {
        const over = c.totalSpent - c.budget;
        lines.push(`- **${c.name}**: Over budget by $${over.toLocaleString(undefined, { maximumFractionDigits: 0 })} (consider raising monthly budget by ~$${Math.ceil(over / 12)}/mo)`);
      });
    }

    setAiAnalysis(lines.join("\n"));
  };

  const handleApplySingleRollover = async (cat: Category) => {
    setApplyingId(cat.id);
    try {
      const res = await applySingleCategoryRollover(cat.id, selectedYear, cat.currentBalance);
      showToast(`Rolled $${cat.currentBalance.toLocaleString()} for ${cat.name} into ${res.targetYear}`, "success");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to apply rollover", "error");
    } finally {
      setApplyingId(null);
    }
  };

  const handleFinalizeAll = () => {
    confirm({
      title: `Finalize ${selectedYear} Rollovers?`,
      message: `This will set the starting rollover balance in ${selectedYear + 1} for all ${initialCategories.length} categories to their ${selectedYear} ending balances.`,
      onConfirm: async () => {
        setIsFinalizing(true);
        try {
          const res = await finalizeYearEndRollovers(
            selectedYear,
            initialCategories.map((c) => ({ categoryId: c.id, amount: c.currentBalance }))
          );
          showToast(`Rolled over ${res.count} categories into ${res.targetYear}!`, "success");
          router.refresh();
        } catch (error) {
          showToast(error instanceof Error ? error.message : "Failed to finalize rollovers", "error");
        } finally {
          setIsFinalizing(false);
        }
      },
    });
  };

  return (
    <div className="reports-container">
      <div className="reports-top">
        <div className="year-selector">
          <label>Analysis Year:</label>
          <select value={selectedYear} onChange={(e) => router.push(`/reports?year=${e.target.value}`)}>
            {availableYears.length > 0 ? (
              availableYears.map(y => <option key={y} value={y}>{y}</option>)
            ) : (
              <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            )}
          </select>
        </div>
        <Button variant="primary" onClick={handleRunAnalysis}>
          📊 Generate Insights
        </Button>
      </div>

      <div className="reports-grid">
        <div className="reports-main">
          {aiAnalysis && (
            <Card className="ai-report glass animate-fade-in">
              <div className="ai-report-content">
                {aiAnalysis.split('\n').map((line, i) => (
                  <p key={i} style={{ marginBottom: line.startsWith('-') ? '0.5rem' : '1rem' }}>
                    {line.startsWith('##') ? <h3 className="mt-0">{line.replace('## ', '')}</h3> : line}
                  </p>
                ))}
              </div>
            </Card>
          )}

          <Card className="category-performance glass">
            <h3>Yearly Spending by Category</h3>
            <div className="performance-list">
               <div className="performance-header">
                  <span>Category</span>
                  <span className="text-right">Spent</span>
                  <span className="text-right">Avgg monthly</span>
                  <span className="text-right">Current balance</span>
               </div>
               {initialCategories.map(cat => {
                 const elapsedMonths = new Date().getFullYear() === selectedYear ? (new Date().getMonth() + 1) : 12;
                 const avgMonthly = cat.totalSpent / elapsedMonths;
                 return (
                   <div key={cat.id} className="performance-row">
                      <span className="cat-name">{cat.name}</span>
                      <span className="text-right">${cat.totalSpent.toLocaleString()}</span>
                      <span className="text-right">${avgMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className={`text-right font-bold ${cat.currentBalance < 0 ? 'text-danger' : 'text-success'}`}>
                        ${cat.currentBalance.toLocaleString()}
                      </span>
                   </div>
                 );
               })}
            </div>
          </Card>
        </div>

        <aside className="reports-sidebar">
          <Card className="rollover-box glass">
            <h3>Rollover Engine</h3>
            <p className="text-muted">Carry over your hard-earned surpluses into the next calendar year.</p>
            
            <div className="rollover-list">
              {initialCategories.map(cat => {
                const surplus = cat.currentBalance;
                const defaultRoll = surplus > 0 ? surplus : 0;
                return (
                  <div key={cat.id} className="rollover-item">
                     <div className="rollover-info">
                        <span>{cat.name}</span>
                        <span className={surplus > 0 ? "surplus-val" : "text-muted"}>
                          {surplus > 0 ? `+$${surplus.toLocaleString()}` : `$0`}
                        </span>
                     </div>
                     <div className="rollover-action">
                        <input
                          type="number"
                          defaultValue={defaultRoll}
                          id={`rollover-input-${cat.id}`}
                          placeholder="Amt to roll..."
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            const el = document.getElementById(`rollover-input-${cat.id}`) as HTMLInputElement | null;
                            const val = el ? parseFloat(el.value) : defaultRoll;
                            handleApplySingleRollover({ ...cat, currentBalance: isNaN(val) ? defaultRoll : val });
                          }}
                          disabled={applyingId === cat.id || isFinalizing}
                        >
                          {applyingId === cat.id ? "..." : "Apply"}
                        </Button>
                     </div>
                  </div>
                );
              })}
            </div>
            
            <div className="rollover-footer">
               <Button
                 className="w-full"
                 onClick={handleFinalizeAll}
                 disabled={isFinalizing || initialCategories.length === 0}
               >
                 {isFinalizing ? "Finalizing..." : "Finalize Year-End Rollovers"}
               </Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
