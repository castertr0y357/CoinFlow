"use client";

import { useState } from "react";
import { categorizeSplit, applyTransactionSplits, hideTransaction } from "./actions";
import Button from "@/components/ui/Button";
import { Category, Transaction } from "@/types";

export default function TransactionRow({ 
  tx, 
  categories,
  suggestion,
  onCategorized
}: { 
  tx: Transaction; 
  categories: Category[];
  suggestion?: string;
  onCategorized?: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [isAiSplitting, setIsAiSplitting] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const handleCategoryChange = async (splitId: string, categoryId: string) => {
    setIsPending(true);
    await categorizeSplit(splitId, categoryId === "floating" ? null : categoryId);
    setIsPending(false);
    if (onCategorized) onCategorized();
  };

  const handleSmartSplit = async () => {
    setIsAiSplitting(true);
    try {
      const res = await fetch('/api/v1/ai/suggest-splits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''
        },
        body: JSON.stringify({ transactionId: tx.id })
      });
      const data = await res.json();
      if (data.splits) {
        if (confirm(`AI suggests splitting this into ${data.splits.length} categories. Apply now?`)) {
          setIsPending(true);
          await applyTransactionSplits(tx.id, data.splits);
          setIsPending(false);
          if (onCategorized) onCategorized();
        }
      }
    } catch (error) {
      console.error("Smart Split Error:", error);
    } finally {
      setIsAiSplitting(false);
    }
  };

  const handleHide = async () => {
    setIsPending(true);
    await hideTransaction(tx.id, !(tx as any).isHidden);
    setIsPending(false);
    if (onCategorized) onCategorized();
  };

  const suggestedCategory = categories.find(c => c.id === suggestion);

  return (
    <div className={`tx-row ${isPending ? 'pending' : ''} ${suggestion ? 'has-suggestion' : ''}`}>
      <div className="tx-main">
        <div className="tx-date">
          {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <div className="tx-payee">
          <div className="payee-text" onClick={() => setShowRaw(!showRaw)} style={{ cursor: 'pointer' }}>
            {showRaw ? (
               <span className="raw-payee">{tx.rawPayee || tx.payee} 🏦</span>
            ) : (
               <span className="clean-payee">{tx.payee}</span>
            )}
            
            {tx.amazonOrderId && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="smart-split-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSmartSplit();
                }}
                disabled={isAiSplitting || isPending}
              >
                {isAiSplitting ? "✨ Analyzing..." : "✨ Smart Split"}
              </Button>
            )}
          </div>
          {suggestion && !tx.splits.every(s => s.categoryId) && (
            <span className="ai-badge animate-pulse">✨ AI Suggested: {suggestedCategory?.name}</span>
          )}
        </div>
        <div className={`tx-amount ${Number(tx.amount) < 0 ? 'danger' : 'accent'}`}>
          {Number(tx.amount) < 0 ? '-' : '+'}${Math.abs(Number(tx.amount)).toFixed(2)}
        </div>
      </div>
      
      <div className="tx-splits">
        <div className="splits-container">
          {tx.splits.map(split => (
            <div key={split.id} className="tx-split">
              <span className="split-amount" title={split.memo || undefined}>
                ${Math.abs(Number(split.amount)).toFixed(2)}
                {split.memo && <span className="split-memo-icon" title={split.memo}>📝</span>}
              </span>
              <select 
                className={`split-category-select ${suggestion && !split.categoryId ? 'suggested' : ''}`}
                value={split.categoryId || "floating"}
                onChange={(e) => handleCategoryChange(split.id, e.target.value)}
                disabled={isPending}
              >
                <option value="floating">🌊 Floating (Uncategorized)</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.id === suggestion ? `✨ ${cat.name}` : cat.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <button 
          className="row-action-btn hide-btn" 
          onClick={handleHide}
          disabled={isPending}
          title={(tx as any).isHidden ? "Unhide Transaction" : "Hide Transaction"}
        >
          {(tx as any).isHidden ? "👁️" : "✖"}
        </button>
      </div>
    </div>
  );
}
