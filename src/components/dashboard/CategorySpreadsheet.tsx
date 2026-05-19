"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { moveCategory, reorderCategories } from "@/app/categories/actions";

interface Category {
  id: string;
  name: string;
  budget: number;
  provisions: number;
  rollover: number;
  spent: number;
  remaining: number;
  tiedAccountId?: string | null;
  isOffBudget: boolean;
  isPaused: boolean;
  commitments?: number;
}

interface CategorySpreadsheetProps {
  categories: Category[];
  integrityWarnings?: { accountId?: string; message: string; severity: string }[];
  onRefresh: () => void;
}

export default function CategorySpreadsheet({ categories, integrityWarnings = [], onRefresh }: CategorySpreadsheetProps) {
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    try {
      await moveCategory(id, direction);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const newOrder = [...categories];
    const currentIndex = newOrder.findIndex(c => c.id === draggedId);
    const targetIndex = newOrder.findIndex(c => c.id === targetId);

    if (currentIndex === -1 || targetIndex === -1) return;

    const [moved] = newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, moved);

    try {
      await reorderCategories(newOrder.map(c => c.id));
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDraggedId(null);
    }
  };

  return (
    <Card className="category-spreadsheet-card glass" animate={true} delay="0.2s">
      <div className="card-header-flex">
        <div className="header-info">
          <h3>Category Overview</h3>
          <span className="text-dim text-xs">Click row for details</span>
        </div>
        <Button 
          variant={isEditingOrder ? "primary" : "ghost"} 
          size="sm" 
          onClick={() => setIsEditingOrder(!isEditingOrder)}
        >
          {isEditingOrder ? "💾 Done Ordering" : "🔃 Edit Order"}
        </Button>
      </div>
      <div className="spreadsheet-container">
        <table className="spreadsheet-table">
          <thead>
            <tr>
              {isEditingOrder && <th className="order-th">Order</th>}
              <th className="sticky-col">Category</th>
              <th className="text-right">Budgeted</th>
              <th className="text-right">Commitments</th>
              <th className="text-right">Spent</th>
              <th className="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, index) => {
              return (
                <tr 
                  key={cat.id} 
                  className={`spreadsheet-row ${draggedId === cat.id ? 'dragging' : ''} ${cat.isOffBudget ? 'off-budget-row' : ''}`}
                  draggable={isEditingOrder}
                  onDragStart={(e) => handleDragStart(e, cat.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, cat.id)}
                >
                  {isEditingOrder && (
                    <td className="order-td">
                      <div className="order-ui">
                        <div className="drag-handle" title="Drag to reorder">⠿</div>
                      </div>
                    </td>
                  )}
                  <td className="sticky-col">
                    <Link href={`/categories/${cat.id}`} className="row-link">
                      <span className="cat-name">{cat.name}</span>
                      {cat.tiedAccountId && <span className="tied-badge" title={cat.isOffBudget ? "Tied to Off-Budget Account" : "Tied to specific account"}>⚓</span>}
                      {cat.isOffBudget && <span className="off-budget-badge" title="Excluded from Available to Budget">🏦</span>}
                      {cat.isPaused && <span className="paused-badge" title="Automatic budgeting paused">⏸️</span>}
                      {integrityWarnings.find(w => w.accountId === cat.tiedAccountId) && (
                        <span className="integrity-danger" title={integrityWarnings.find(w => w.accountId === cat.tiedAccountId)?.message}>❗</span>
                      )}
                    </Link>
                  </td>
                  <td className="text-right budgeted-cell">
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end', width: '100%' }}>
                      {cat.commitments && cat.commitments > 0 && cat.budget < cat.commitments && (
                        <span className="underfunded-badge" title={`Underfunded! Obligations require $${cat.commitments.toLocaleString()}/mo, but you only budgeted $${cat.budget.toLocaleString()}/mo.`}>
                          ⚠️
                        </span>
                      )}
                      <span>${cat.budget.toLocaleString()}</span>
                    </div>
                  </td>
                  <td className="text-right commitments-cell">
                    {cat.commitments && cat.commitments > 0 ? `$${cat.commitments.toLocaleString()}/mo` : '—'}
                  </td>
                  <td className="text-right spent-cell">
                    ${cat.spent.toLocaleString()}
                  </td>
                  <td className={`text-right balance-cell ${cat.remaining < 0 ? 'neg' : 'pos'}`}>
                    ${cat.remaining.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .category-spreadsheet-card {
          border-radius: 8px;
          padding: 1rem;
        }
        .card-header-flex {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          padding: 0 0.5rem;
        }
        .spreadsheet-container {
          overflow-x: auto;
        }
        .spreadsheet-table {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-sans);
        }
        th {
          text-align: left;
          padding: 0.4rem 0.75rem;
          color: var(--text-muted);
          font-weight: 700;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--glass-border);
          background: rgba(0, 0, 0, 0.1);
        }
        td {
          padding: 0.4rem 0.75rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          font-size: 0.85rem;
          white-space: nowrap;
        }
        .order-td { width: 30px; text-align: center; }
        .drag-handle { cursor: grab; color: var(--text-muted); }
        
        .sticky-col {
          position: sticky;
          left: 0;
          background: #16161a;
          z-index: 5;
        }
        .spreadsheet-row:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .off-budget-row {
          opacity: 0.6;
        }
        .off-budget-row:hover {
          opacity: 1;
        }
        .row-link {
          color: var(--text-main);
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .tied-badge {
          font-size: 0.7rem;
          opacity: 0.5;
        }
        .off-budget-badge {
          font-size: 0.7rem;
          filter: grayscale(1);
          opacity: 0.6;
        }
        .paused-badge {
          font-size: 0.7rem;
          opacity: 0.8;
          filter: grayscale(1);
        }
        .text-right { text-align: right; }
        .budgeted-cell { color: var(--text-dim); }
        .commitments-cell { color: var(--accent); font-weight: 500; font-family: 'JetBrains Mono', monospace; }
        .underfunded-badge {
          cursor: help;
          font-size: 0.8rem;
          animation: warningPulse 2s infinite ease-in-out;
        }
        @keyframes warningPulse {
          0% { opacity: 0.6; transform: scale(0.95); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.6; transform: scale(0.95); }
        }
        .spent-cell { color: var(--text-muted); }
        .balance-cell { font-weight: 700; }
        .balance-cell.pos { color: #10b981; }
        .balance-cell.neg { color: #ef4444; }
        
        .spreadsheet-row.dragging {
          opacity: 0.3;
        }
      `}</style>
    </Card>
  );
}
