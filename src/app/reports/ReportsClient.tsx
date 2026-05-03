"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import "./Reports.css";

interface Category {
  id: string;
  name: string;
  budget: number;
  adjustment: number;
  rollover: number;
  totalSpent: number;
}

interface ReportsClientProps {
  availableYears: number[];
  initialCategories: Category[];
}

export default function ReportsClient({ availableYears, initialCategories }: ReportsClientProps) {
  const [selectedYear, setSelectedYear] = useState(availableYears[0] || new Date().getFullYear());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  const handleRunAnalysis = async () => {
    setIsAnalyzing(true);
    // In a real app, call an AI endpoint here
    setTimeout(() => {
      setAiAnalysis(`## ${selectedYear} Year-End Review\n\nBased on your spending patterns:\n- **Groceries**: You were under budget by $450 this year. Excellent discipline!\n- **Dining Out**: This peaked in Q3. Consider a monthly "Dining Cap" to save an extra $1,200 next year.\n- **Utilities**: Higher than average in July/August. Investigate insulation or AC efficiency.\n\n**Recommendation**: Roll over 50% of your 'Groceries' surplus into your 'Savings' category to accelerate your mortgage payoff by 3 months.`);
      setIsAnalyzing(false);
    }, 2000);
  };

  return (
    <div className="reports-container">
      <div className="reports-top">
        <div className="year-selector">
          <label>Analysis Year:</label>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {availableYears.length > 0 ? (
              availableYears.map(y => <option key={y} value={y}>{y}</option>)
            ) : (
              <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
            )}
          </select>
        </div>
        <Button variant="primary" onClick={handleRunAnalysis} disabled={isAnalyzing}>
          {isAnalyzing ? "✨ Analyzing Data..." : "✨ Generate AI Analysis"}
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
                  <span className="text-right">Avg Monthly</span>
                  <span className="text-right">Budget</span>
                  <span className="text-right">Remaining</span>
               </div>
               {initialCategories.map(cat => {
                 const remaining = cat.budget + cat.rollover + cat.adjustment - cat.totalSpent;
                 const elapsedMonths = new Date().getFullYear() === selectedYear ? (new Date().getMonth() + 1) : 12;
                 const avgMonthly = cat.totalSpent / elapsedMonths;
                 return (
                   <div key={cat.id} className="performance-row">
                      <span className="cat-name">{cat.name}</span>
                      <span className="text-right">${cat.totalSpent.toLocaleString()}</span>
                      <span className="text-right">${avgMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-right">${(cat.budget + cat.rollover + cat.adjustment).toLocaleString()}</span>
                      <span className={`text-right font-bold ${remaining < 0 ? 'text-danger' : 'text-success'}`}>
                        ${remaining.toLocaleString()}
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
              {initialCategories.filter(c => c.totalSpent < (c.budget + c.rollover + c.adjustment)).map(cat => (
                <div key={cat.id} className="rollover-item">
                   <div className="rollover-info">
                      <span>{cat.name}</span>
                      <span className="surplus-val">+${(cat.budget + cat.rollover + cat.adjustment - cat.totalSpent).toLocaleString()}</span>
                   </div>
                   <div className="rollover-action">
                      <input type="number" placeholder="Amt to roll..." />
                      <Button size="sm" variant="ghost">Apply</Button>
                   </div>
                </div>
              ))}
            </div>
            
            <div className="rollover-footer">
               <Button className="w-full">Finalize Year-End Rollovers</Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
