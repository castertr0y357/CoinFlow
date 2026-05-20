"use client";

import { useState } from "react";
import { categorizeSplit, applyTransactionSplits, hideTransaction, addSplit, deleteTransactionSplit } from "./actions";
import Button from "@/components/ui/Button";
import { Category, Transaction } from "@/types";

export default function TransactionRow({ 
  tx, 
  categories,
  suggestion,
  onCategorized,
  isSelected,
  onSelectionToggle
}: { 
  tx: Transaction; 
  categories: Category[];
  suggestion?: string;
  onCategorized?: () => void;
  isSelected?: boolean;
  onSelectionToggle?: (id: string, selected: boolean) => void;
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

  const handleAddSplit = async () => {
    const amountStr = prompt("Enter amount for new split:");
    if (!amountStr) return;
    
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid positive amount.");
      return;
    }

    setIsPending(true);
    try {
      // For expenses, we send a negative amount to match the transaction sign
      const splitAmount = Number(tx.amount) < 0 ? -Math.abs(amount) : Math.abs(amount);
      await addSplit(tx.id, splitAmount, null);
      if (onCategorized) onCategorized();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsPending(false);
    }
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

  const handleDeleteSplit = async (splitId: string) => {
    setIsPending(true);
    try {
      await deleteTransactionSplit(splitId);
      if (onCategorized) onCategorized();
    } catch (error) {
      console.error("Failed to delete split:", error);
    } finally {
      setIsPending(false);
    }
  };

  const suggestedCategory = categories.find(c => c.id === suggestion);

  const sortedSplits = [...tx.splits].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (timeA !== timeB) return timeA - timeB;
    return a.id.localeCompare(b.id);
  });

  return (
    <div className={`tx-row ${isPending ? 'pending' : ''} ${suggestion ? 'has-suggestion' : ''} ${isSelected ? 'selected' : ''}`}>
      <div className="tx-checkbox-cell">
        <input 
          type="checkbox" 
          className="tx-checkbox" 
          checked={isSelected} 
          onChange={(e) => onSelectionToggle?.(tx.id, e.target.checked)}
        />
      </div>
      <div className="tx-main">
        <div className="tx-date">
          {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
        </div>
        <div className="tx-payee">
          <div className="payee-text" onClick={() => setShowRaw(!showRaw)} style={{ cursor: 'pointer' }}>
            {showRaw ? (
               <span className="raw-payee">{tx.rawPayee || tx.payee} 🏦</span>
            ) : (
               <span className="clean-payee">{tx.payee}</span>
            )}
            
            {tx.externalOrderId && (
              <div className="external-order-info">
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
                {!!tx.externalOrder && (
                  <div className="order-details-popover glass">
                    <div className="order-header">
                      <strong>{tx.externalOrder.source} Order #{tx.externalOrder.orderId}</strong>
                    </div>
                    <ul className="order-items">
                      {tx.externalOrder.items?.map((item) => (
                        <li key={item.id} className="order-item">
                          <span className="item-qty">{item.quantity}x</span>
                          <span className="item-title">{item.title}</span>
                          <span className="item-price">${Number(item.price).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
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
          {sortedSplits.map(split => (
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
              {tx.splits.length > 1 && (
                <button 
                  className="delete-split-btn" 
                  onClick={() => handleDeleteSplit(split.id)}
                  disabled={isPending}
                  title="Delete Split"
                >
                  ✖
                </button>
              )}
            </div>
          ))}
          <button 
            className="row-action-btn add-split-btn" 
            onClick={handleAddSplit}
            disabled={isPending}
            title="Add Split"
          >
            ➕
          </button>
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
