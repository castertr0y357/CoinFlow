"use client";

import { useState } from "react";
import { categorizeSplit, applyTransactionSplits, hideTransaction, addSplit, deleteTransactionSplit, updateTransactionMemo, linkRefundAction } from "./actions";
import Button from "@/components/ui/Button";
import { Category, Transaction, Split } from "@/types";

interface RefundCandidateSplit {
  id: string;
  amount: number;
  categoryId: string | null;
  categoryName: string;
  memo: string | null;
}

interface RefundCandidate {
  id: string;
  date: Date | string;
  amount: number;
  payee: string;
  splits: RefundCandidateSplit[];
}

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
  const [refundCandidates, setRefundCandidates] = useState<RefundCandidate[] | null>(null);
  const [showRefundMatcher, setShowRefundMatcher] = useState(false);
  const [isSearchingRefunds, setIsSearchingRefunds] = useState(false);

  const handleFindRefundMatches = async () => {
    setIsSearchingRefunds(true);
    try {
      const res = await fetch(`/api/v1/transactions/refund-matches?transactionId=${tx.id}`, {
        headers: { 'X-API-KEY': process.env.NEXT_PUBLIC_INTERNAL_API_KEY || '' }
      });
      const data = await res.json();
      setRefundCandidates(data.matches || []);
      setShowRefundMatcher(true);
    } catch (error) {
      console.error("Refund search error:", error);
      alert("Error searching for refund matches");
    } finally {
      setIsSearchingRefunds(false);
    }
  };

  const handleLinkRefund = async (candidate: RefundCandidate) => {
    const targetCategory = candidate.splits[0]?.categoryId;
    const targetCategoryName = candidate.splits[0]?.categoryName || "Uncategorized";
    
    if (!targetCategory) {
      alert("The selected purchase has no category assigned. Please categorize the original purchase first.");
      return;
    }
    
    if (confirm(`Link refund to original purchase? This will set this refund's category to "${targetCategoryName}" to offset your spending.`)) {
      setIsPending(true);
      try {
        await linkRefundAction(tx.id, targetCategory);
        setShowRefundMatcher(false);
        if (onCategorized) onCategorized();
      } catch (error) {
        console.error(error);
        alert("Failed to link refund");
      } finally {
        setIsPending(false);
      }
    }
  };

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
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "An error occurred";
      alert(errMsg);
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
    await hideTransaction(tx.id, !tx.isHidden);
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

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [prevMemo, setPrevMemo] = useState(tx.memo);
  const [noteDraft, setNoteDraft] = useState(tx.memo || "");

  if (tx.memo !== prevMemo) {
    setPrevMemo(tx.memo);
    setNoteDraft(tx.memo || "");
  }

  const handleSaveNote = async () => {
    setIsPending(true);
    try {
      await updateTransactionMemo(tx.id, noteDraft);
      setIsEditingNote(false);
      if (onCategorized) onCategorized();
    } catch (error) {
      console.error("Failed to update transaction memo:", error);
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
    <div className={`tx-row-container ${isPending ? 'pending' : ''} ${suggestion ? 'has-suggestion' : ''} ${isSelected ? 'selected' : ''}`}>
      <div className="tx-row-main-content">
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
            <div className="payee-text-click-area" onClick={() => setIsEditingNote(!isEditingNote)} style={{ cursor: 'pointer' }}>
              <div className="payee-text">
                <span onClick={(e) => {
                  e.stopPropagation();
                  setShowRaw(!showRaw);
                }}>
                  {showRaw ? (
                     <span className="raw-payee">{tx.rawPayee || tx.payee} 🏦</span>
                  ) : (
                     <span className="clean-payee">{tx.payee}</span>
                  )}
                </span>
                
                {tx.externalOrderId && (
                  <div onClick={(e) => e.stopPropagation()} style={{ display: 'inline-block' }}>
                    <div className="external-order-info">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="smart-split-btn"
                        onClick={() => handleSmartSplit()}
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
                  </div>
                )}
              </div>

              {tx.memo && !isEditingNote && (
                <span className="tx-memo text-dim" style={{ fontSize: '0.75rem', opacity: 0.7, display: 'block', marginTop: '0.25rem' }}>
                  📝 {tx.memo}
                </span>
              )}
              {!tx.memo && !isEditingNote && (
                <span className="tx-memo text-dim placeholder" style={{ fontSize: '0.75rem', opacity: 0.4, display: 'block', marginTop: '0.25rem' }}>
                  💬 Add note...
                </span>
              )}
            </div>

            {suggestion && !tx.splits.every(s => s.categoryId) && (
              <span className="ai-badge animate-pulse" style={{ marginTop: '0.25rem' }}>✨ AI Suggested: {suggestedCategory?.name}</span>
            )}
          </div>
          <div className={`tx-amount ${Number(tx.amount) < 0 ? 'danger' : 'accent'}`}>
            {Number(tx.amount) < 0 ? '-' : '+'}${Math.abs(Number(tx.amount)).toFixed(2)}
            {Number(tx.amount) > 0 && !tx.splits.every(s => s.categoryId) && (
              <button 
                className="row-action-btn refund-match-btn"
                onClick={handleFindRefundMatches}
                disabled={isPending || isSearchingRefunds}
                style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', border: '1px solid var(--glass-border)', color: 'var(--text-main)' }}
                title="Match Refund"
              >
                {isSearchingRefunds ? "🔍..." : "🔍 Match"}
              </button>
            )}
          </div>
        </div>
        
        <div className="tx-splits">
          <div className="splits-container">
            {sortedSplits.map(split => (
              <SplitItem
                key={split.id}
                split={split}
                categories={categories}
                suggestion={suggestion}
                isPending={isPending}
                onCategoryChange={(catId) => handleCategoryChange(split.id, catId)}
                onDeleteSplit={() => handleDeleteSplit(split.id)}
                showDelete={tx.splits.length > 1}
                showAmount={tx.splits.length > 1}
              />
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
            title={tx.isHidden ? "Unhide Transaction" : "Hide Transaction"}
          >
            {tx.isHidden ? "👁️" : "✖"}
          </button>
        </div>
      </div>

      {showRefundMatcher && (
        <div className="tx-refund-matcher-row glass animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ padding: '1rem', marginTop: '0.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(22, 22, 26, 0.95)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <strong style={{ fontSize: '0.85rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔍</span> Refund Match Finder
            </strong>
            <Button variant="ghost" size="sm" onClick={() => setShowRefundMatcher(false)}>Close</Button>
          </div>
          {refundCandidates && refundCandidates.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p className="text-dim" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                Select a matching purchase from the last 90 days to copy its category and offset your spending:
              </p>
              {refundCandidates.map(cand => (
                <div 
                  key={cand.id} 
                  className="refund-candidate-item glass" 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.75rem', borderRadius: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }} 
                  onClick={() => handleLinkRefund(cand)}
                >
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.8rem' }}>
                    <span className="font-mono text-muted" style={{ fontSize: '0.75rem' }}>
                      {new Date(cand.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
                    </span>
                    <strong>{cand.payee}</strong>
                    <span className="text-danger font-mono" style={{ fontWeight: '700' }}>-${Math.abs(cand.amount).toFixed(2)}</span>
                  </div>
                  <div>
                    {cand.splits.map((s, idx: number) => (
                      <span 
                        key={idx} 
                        className="badge" 
                        style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'white', padding: '3px 8px', borderRadius: '4px', marginLeft: '0.5rem', fontWeight: '600' }}
                      >
                        {s.categoryName}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted" style={{ fontSize: '0.75rem' }}>
              No matching purchases found in the last 90 days. You can still manually select a category from the dropdown.
            </p>
          )}
        </div>
      )}
 
      {isEditingNote && (
        <div className="tx-note-edit-row glass animate-fade-in" onClick={(e) => e.stopPropagation()}>
          <div className="tx-note-edit-field">
            <span className="note-label">Transaction Note</span>
            <textarea
              className="tx-note-input"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Add a note or comment for this transaction..."
              autoFocus
              rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveNote();
                }
                if (e.key === 'Escape') {
                  setIsEditingNote(false);
                }
              }}
            />
          </div>
          <div className="tx-note-edit-actions">
            <Button size="sm" onClick={handleSaveNote} disabled={isPending}>Save Note</Button>
            <Button size="sm" variant="ghost" onClick={() => setIsEditingNote(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SplitItemProps {
  split: Split;
  categories: Category[];
  suggestion?: string;
  isPending: boolean;
  onCategoryChange: (categoryId: string) => void;
  onDeleteSplit: () => void;
  showDelete: boolean;
  showAmount: boolean;
}

function SplitItem({
  split,
  categories,
  suggestion,
  isPending,
  onCategoryChange,
  onDeleteSplit,
  showDelete,
  showAmount
}: SplitItemProps) {
  return (
    <div className="tx-split">
      {showAmount && (
        <span className="split-amount" title={split.memo || undefined}>
          ${Math.abs(Number(split.amount)).toFixed(2)}
          {split.memo && <span className="split-memo-icon" title={split.memo}>📝</span>}
        </span>
      )}
      
      <select 
        className={`split-category-select ${suggestion && !split.categoryId ? 'suggested' : ''}`}
        value={split.categoryId || "floating"}
        onChange={(e) => onCategoryChange(e.target.value)}
        disabled={isPending}
      >
        <option value="floating">🌊 Floating (Uncategorized)</option>
        {categories.map(cat => (
          <option key={cat.id} value={cat.id}>
            {cat.id === suggestion ? `✨ ${cat.name}` : cat.name}
          </option>
        ))}
      </select>

      {showDelete && (
        <button 
          className="delete-split-btn" 
          onClick={onDeleteSplit}
          disabled={isPending}
          title="Delete Split"
        >
          ✖
        </button>
      )}
    </div>
  );
}
