"use client";

import { useState } from "react";
import { categorizeSplit, applyTransactionSplits, hideTransaction, addSplit, deleteTransactionSplit, updateTransactionMemo, linkRefundAction } from "./actions";
import Button from "@/components/ui/Button";
import { Category, Transaction, Split } from "@/types";
import { useNotification } from "@/components/ui/NotificationProvider";

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
  onSelectionToggle,
  aiEnabled = false,
  onAccountClick
}: { 
  tx: Transaction; 
  categories: Category[];
  suggestion?: string;
  onCategorized?: () => void;
  isSelected?: boolean;
  onSelectionToggle?: (id: string, selected: boolean) => void;
  aiEnabled?: boolean;
  onAccountClick?: (accountId: string) => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [isAiSplitting, setIsAiSplitting] = useState(false);
  const [isAddingSplit, setIsAddingSplit] = useState(false);
  const [newSplitAmount, setNewSplitAmount] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [refundCandidates, setRefundCandidates] = useState<RefundCandidate[] | null>(null);
  const [showRefundMatcher, setShowRefundMatcher] = useState(false);
  const [isSearchingRefunds, setIsSearchingRefunds] = useState(false);

  const { showToast, confirm } = useNotification();

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
      showToast("Error searching for refund matches", "error");
    } finally {
      setIsSearchingRefunds(false);
    }
  };

  const handleLinkRefund = async (candidate: RefundCandidate) => {
    const targetCategory = candidate.splits[0]?.categoryId;
    const targetCategoryName = candidate.splits[0]?.categoryName || "Uncategorized";
    
    if (!targetCategory) {
      showToast("The selected purchase has no category assigned. Please categorize the original purchase first.", "error");
      return;
    }
    
    confirm({
      title: "Link Refund",
      message: `Link refund to original purchase? This will set this refund's category to "${targetCategoryName}" to offset your spending.`,
      onConfirm: async () => {
        setIsPending(true);
        try {
          await linkRefundAction(tx.id, targetCategory);
          setShowRefundMatcher(false);
          if (onCategorized) onCategorized();
          showToast("Refund linked successfully", "success");
        } catch (error) {
          console.error(error);
          showToast("Failed to link refund", "error");
        } finally {
          setIsPending(false);
        }
      }
    });
  };

  const handleCategoryChange = async (splitId: string, categoryId: string) => {
    setIsPending(true);
    await categorizeSplit(splitId, categoryId === "floating" ? null : categoryId);
    setIsPending(false);
    if (onCategorized) onCategorized();
  };

  const handleAddSplit = () => {
    setIsAddingSplit(true);
    setNewSplitAmount("");
  };

  const handleConfirmAddSplit = async () => {
    const amount = parseFloat(newSplitAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast("Please enter a valid positive amount.", "error");
      return;
    }

    setIsPending(true);
    try {
      const splitAmount = Number(tx.amount) < 0 ? -Math.abs(amount) : Math.abs(amount);
      await addSplit(tx.id, splitAmount, null);
      setIsAddingSplit(false);
      setNewSplitAmount("");
      if (onCategorized) onCategorized();
      showToast("Split added successfully", "success");
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "An error occurred";
      showToast(errMsg, "error");
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
        confirm({
          title: "Apply Smart Split",
          message: `AI suggests splitting this into ${data.splits.length} categories. Apply now?`,
          onConfirm: async () => {
            setIsPending(true);
            try {
              await applyTransactionSplits(tx.id, data.splits);
              if (onCategorized) onCategorized();
              showToast("Smart split applied successfully!", "success");
            } catch (error) {
              console.error(error);
              showToast("Failed to apply smart split", "error");
            } finally {
              setIsPending(false);
            }
          }
        });
      }
    } catch (error) {
      console.error("Smart Split Error:", error);
      showToast("Error processing smart split suggestion", "error");
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

  const hasExternalOrder = !!(tx.externalOrderId || tx.matchedOrderId);
  const orderItems = tx.externalOrder?.items && tx.externalOrder.items.length > 0
    ? tx.externalOrder.items.map((item) => ({
        id: item.id,
        title: item.title,
        price: Number(item.price),
        quantity: item.quantity,
      }))
    : tx.splits
        .filter((s) => !!s.memo)
        .map((split) => ({
          id: split.id,
          title: split.memo as string,
          price: Math.abs(Number(split.amount)),
          quantity: null as number | null,
        }));
  const isSingleItemOrder = hasExternalOrder && orderItems.length === 1;

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
                
                {hasExternalOrder && (
                  <div onClick={(e) => e.stopPropagation()} style={{ display: 'inline-block' }}>
                    <div className="external-order-info">
                      {isSingleItemOrder ? (
                        <span className="order-badge-pill">
                          📦 Order
                        </span>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="smart-split-btn"
                          onClick={() => handleSmartSplit()}
                          disabled={isAiSplitting || isPending}
                        >
                          {isAiSplitting ? "⚡ Splitting..." : aiEnabled ? "✨ Smart Split" : "⚡ Smart Split"}
                        </Button>
                      )}
                      {(!!tx.externalOrder || !!tx.matchedOrderId) && (
                        <div className="order-details-popover glass">
                          <div className="order-header">
                            <strong>{tx.matchedOrderSource || tx.externalOrder?.source} Order #{tx.matchedOrderId || tx.externalOrder?.orderId}</strong>
                          </div>
                          <ul className="order-items">
                            {orderItems.map((item) => (
                              <li key={item.id} className="order-item">
                                {item.quantity !== null && <span className="item-qty">{item.quantity}x</span>}
                                <span className="item-title">{item.title}</span>
                                <span className="item-price">${item.price.toFixed(2)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {isSingleItemOrder && (
                <span className="tx-single-order-item" title={orderItems[0].title}>
                  📦 {orderItems[0].title}
                </span>
              )}

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

              {/* Mobile Account Badge */}
              {tx.account && (
                <div className="tx-mobile-account-badge" onClick={(e) => e.stopPropagation()}>
                  <span 
                    className="account-badge-pill"
                    onClick={() => onAccountClick?.(tx.accountId)}
                    title="Filter by this account"
                  >
                    🏦 {tx.account.displayName || tx.account.name}
                  </span>
                </div>
              )}
            </div>

            {isAddingSplit && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.35rem" }}>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  autoFocus
                  placeholder="Split amount..."
                  value={newSplitAmount}
                  onChange={(e) => setNewSplitAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleConfirmAddSplit();
                    if (e.key === "Escape") setIsAddingSplit(false);
                  }}
                  style={{ width: "7rem", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--accent)", background: "rgba(0,0,0,0.35)", color: "var(--text-main)", fontSize: "0.8rem" }}
                />
                <Button size="sm" variant="primary" onClick={handleConfirmAddSplit} disabled={isPending}>Add</Button>
                <Button size="sm" variant="ghost" onClick={() => setIsAddingSplit(false)}>Cancel</Button>
              </div>
            )}
            {suggestion && suggestedCategory && !tx.splits.every(s => s.categoryId) && (
              <button
                type="button"
                className="ai-badge"
                onClick={(e) => {
                  e.stopPropagation();
                  if (tx.splits[0]) {
                    handleCategoryChange(tx.splits[0].id, suggestion);
                  }
                }}
                disabled={isPending}
                title="Click to accept this category"
                style={{ marginTop: '0.25rem', cursor: 'pointer', border: 'none' }}
              >
                ✓ Accept: {suggestedCategory.name}
              </button>
            )}
          </div>
          <div className="tx-account">
            {tx.account && (
              <span 
                className="account-badge-pill"
                onClick={() => onAccountClick?.(tx.accountId)}
                title="Filter by this account"
              >
                🏦 {tx.account.displayName || tx.account.name}
              </span>
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
                aiEnabled={aiEnabled}
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
  aiEnabled?: boolean;
}

function SplitItem({
  split,
  categories,
  suggestion,
  isPending,
  onCategoryChange,
  onDeleteSplit,
  showDelete,
  showAmount,
  aiEnabled = false
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
        className={`split-category-select ${aiEnabled && suggestion && !split.categoryId ? 'suggested' : ''}`}
        value={split.categoryId || "floating"}
        onChange={(e) => onCategoryChange(e.target.value)}
        disabled={isPending}
      >
        <option value="floating">🌊 Floating (Uncategorized)</option>
        {categories.map(cat => (
          <option key={cat.id} value={cat.id}>
            {aiEnabled && cat.id === suggestion ? `✨ ${cat.name}` : cat.name}
            {cat.balance !== undefined ? ` ($${cat.balance < 0 ? '-' : ''}${Math.abs(cat.balance).toFixed(2)})` : ''}
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
