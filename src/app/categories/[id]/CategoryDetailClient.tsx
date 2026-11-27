"use client";

import { useState, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { updateCategoryBudget, reclassifyTransaction, updateTransaction, deleteTransaction, updateCategoryTie, toggleCategoryPause, splitTransactionInCategory } from "../actions";
import AddTransactionModal from "@/components/transactions/AddTransactionModal";
import "./CategoryDetail.css";

interface CategoryCommitment {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  category?: { name: string } | null;
}

interface CategoryDetail {
  id: string;
  name: string;
  budget: number;
  tiedAccountId: string | null;
  isPaused: boolean;
  commitmentsMonthly: number;
  rollover: number;
  spent: number;
  remaining: number;
  commitments?: CategoryCommitment[];
}

interface DetailTransaction {
  id: string;
  payee: string;
  amount: number;
  date: string | Date;
  memo?: string | null;
}

interface CategoryDetailClientProps {
  category: CategoryDetail;
  transactions: DetailTransaction[];
  otherCategories: { id: string, name: string }[];
  accounts: { id: string, name: string }[];
}

interface TxEditFormProps {
  tx: DetailTransaction;
  onSave: (txId: string, data: { payee: string; amount: number; date: string; memo: string }) => Promise<void>;
  onCancel: () => void;
  onDelete: (txId: string) => void;
}

const TxEditForm = memo(function TxEditForm({ tx, onSave, onCancel, onDelete }: TxEditFormProps) {
  const [date, setDate] = useState(() => new Date(tx.date).toISOString().split("T")[0]);
  const [payee, setPayee] = useState(tx.payee);
  const [amount, setAmount] = useState(tx.amount);
  const [memoText, setMemoText] = useState(tx.memo || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onSave(tx.id, { payee, amount, date, memo: memoText });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="tx-edit-form">
      <div className="edit-fields">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input value={payee} onChange={(e) => setPayee(e.target.value)} />
        <Input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
        />
        <div className="edit-fields-full">
          <Input
            placeholder="Note / Memo"
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") onCancel();
            }}
          />
        </div>
      </div>
      <div className="edit-btns">
        <Button size="sm" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onDelete(tx.id)} disabled={isSubmitting}>
          🗑️
        </Button>
      </div>
    </div>
  );
});

export default function CategoryDetailClient({ category, transactions, otherCategories, accounts }: CategoryDetailClientProps) {
  const router = useRouter();
  const [budget, setBudget] = useState(category.budget);
  const [tiedAccountId, setTiedAccountId] = useState(category.tiedAccountId || "");
  const [isPaused, setIsPaused] = useState(category.isPaused || false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [splittingTxId, setSplittingTxId] = useState<string | null>(null);
  const [splitData, setSplitData] = useState({ amount: 0, targetCategoryId: "" });
  const [sortBy, setSortBy] = useState<'date' | 'payee' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [visibleCount, setVisibleCount] = useState(50);

  const refreshUI = () => {
    router.refresh();
    mutate('/api/v1/budget/tally');
  };

  const handleUpdateBudget = async () => {
    setIsSaving(true);
    await Promise.all([
      updateCategoryBudget(category.id, budget),
      updateCategoryTie(category.id, tiedAccountId || null),
      toggleCategoryPause(category.id, isPaused)
    ]);
    refreshUI();
    setIsSaving(false);
  };

  const handleReclassify = async (txId: string, newCatId: string) => {
    const targetName = newCatId === "" ? "Floating (Uncategorized)" : otherCategories.find(c => c.id === newCatId)?.name;
    if (confirm(`Move this transaction to ${targetName}?`)) {
      await reclassifyTransaction(txId, category.id, newCatId === "" ? null : newCatId);
      refreshUI();
    }
  };

  const startEditing = (tx: DetailTransaction) => {
    setEditingTxId(tx.id);
  };

  const saveEdit = async (
    txId: string,
    data: { payee: string; amount: number; date: string; memo: string }
  ) => {
    await updateTransaction(txId, data);
    refreshUI();
    setEditingTxId(null);
  };

  const handleDeleteTx = async (txId: string) => {
    if (confirm("Are you sure you want to delete this transaction? This will affect your available balance.")) {
      await deleteTransaction(txId);
      refreshUI();
    }
  };

  const handleSplit = async (txId: string) => {
    if (splitData.amount <= 0) return;
    setIsSaving(true);
    try {
      await splitTransactionInCategory(txId, category.id, splitData.targetCategoryId, splitData.amount);
      setSplittingTxId(null);
      setSplitData({ amount: 0, targetCategoryId: "" });
      refreshUI();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Split failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSort = (field: 'date' | 'payee' | 'amount') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'payee') {
        comparison = a.payee.localeCompare(b.payee);
      } else if (sortBy === 'amount') {
        comparison = Number(a.amount) - Number(b.amount);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [transactions, sortBy, sortOrder]);

  const visibleTransactions = useMemo(
    () => sortedTransactions.slice(0, visibleCount),
    [sortedTransactions, visibleCount]
  );

  const renderSortIcon = (field: 'date' | 'payee' | 'amount') => {
    if (sortBy !== field) return <span className="sort-icon-placeholder">↕️</span>;
    return <span className="sort-icon active">{sortOrder === 'asc' ? '🔼' : '🔽'}</span>;
  };

  return (
    <>
      {showAddModal && (
        <AddTransactionModal 
          categoryId={category.id}
          categoryName={category.name}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            refreshUI();
          }}
        />
      )}
      
      <div className="category-detail-grid">
        <div className="category-config">
          <Card className="config-card glass">
            <h3>Budget Settings</h3>
            <div className="config-form">
              {category.commitmentsMonthly > 0 && budget < category.commitmentsMonthly && (
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  border: '1px solid rgba(239, 68, 68, 0.3)', 
                  borderRadius: '8px', 
                  padding: '0.75rem', 
                  marginBottom: '1rem', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.25rem' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ef4444', fontWeight: 700, fontSize: '0.85rem' }}>
                    <span>⚠️ Underfunded Alert</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                    Your monthly budget of <strong>${budget.toLocaleString()}</strong> is less than the <strong>${category.commitmentsMonthly.toLocaleString(undefined, { maximumFractionDigits: 2 })}/mo</strong> needed to cover this category&apos;s recurring obligations.
                  </span>
                </div>
              )}

              <div className="config-group">
                <label>Monthly Provision Amount</label>
                <div className="input-with-symbol">
                  <span>$</span>
                  <input 
                    type="number" 
                    value={budget === 0 ? "" : budget} 
                    onChange={e => setBudget(e.target.value === "" ? 0 : Number(e.target.value))} 
                  />
                </div>
                <p className="text-dim text-xs mt-2">This is the amount &quot;deposited&quot; on the 1st of each month.</p>
              </div>

              <div className="config-group mt-4">
                <label>Residing Account</label>
                <select 
                  value={tiedAccountId} 
                  onChange={e => setTiedAccountId(e.target.value)}
                  className="category-select"
                >
                  <option value="">(None - Main Liquidity)</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
                <p className="text-dim text-xs mt-2">Associate this category with a specific bank account.</p>
              </div>

              <div className="config-group mt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isPaused} 
                    onChange={e => setIsPaused(e.target.checked)}
                  />
                  <span>Pause Monthly Budgeting</span>
                </label>
                <p className="text-dim text-xs mt-2">If enabled, automatic monthly provisions will be skipped.</p>
              </div>

              <Button variant="primary" className="w-full mt-4" onClick={handleUpdateBudget} disabled={isSaving}>
                {isSaving ? "Saving..." : "Update Setting"}
              </Button>
            </div>
          </Card>

          {category.commitments && category.commitments.length > 0 && (
            <Card className="commitments-summary-card glass mt-4">
              <h3>Tied Commitments</h3>
              <p className="text-muted text-xs mb-3">Recurring obligations funded by this category.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {category.commitments.map((comm: CategoryCommitment) => {
                  let monthly = comm.amount;
                  if (comm.frequency === "YEARLY") monthly = comm.amount / 12;
                  else if (comm.frequency === "SEMI_ANNUAL") monthly = comm.amount / 6;
                  else if (comm.frequency === "QUARTERLY") monthly = comm.amount / 3;

                  return (
                    <div key={comm.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--glass-border)', padding: '0.6rem 0.75rem', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'white' }}>{comm.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          {comm.frequency.replace('_', ' ')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.15rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                          ${comm.amount.toLocaleString()}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600 }}>
                          ${monthly.toLocaleString(undefined, { maximumFractionDigits: 2 })}/mo
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="math-divider" style={{ margin: '0.5rem 0 0.25rem 0' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent)' }}>
                  <span>Total Obligations</span>
                  <span>${category.commitmentsMonthly.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo</span>
                </div>
              </div>
            </Card>
          )}

          <Card className="summary-card glass mt-4">
             <h3>Ledger Summary</h3>
             <div className="math-row">
                <span>Year Start Rollover</span>
                <span>+${category.rollover.toLocaleString()}</span>
             </div>
             <div className="math-row">
                <span>YTD Transactions (Net)</span>
                <span>{category.spent >= 0 ? '+' : ''}${category.spent.toLocaleString()}</span>
             </div>
             <div className="math-divider"></div>
             <div className="math-row total">
                <span>Current Available</span>
                <span>${category.remaining.toLocaleString()}</span>
             </div>
          </Card>
        </div>

        <div className="category-transactions">
          <Card className="transactions-card glass">
             <div className="sticky-ledger-header">
               <div className="card-header-with-action">
                 <div>
                   <h3>Ledger / Audit Trail</h3>
                   <p className="text-muted">Click any row to edit provisions or spending.</p>
                 </div>
                 <Button variant="glass" size="sm" onClick={() => setShowAddModal(true)}>
                   ➕ Add Entry
                 </Button>
               </div>
               
               <div className="detail-tx-header">
                 <span 
                   className={`sortable-header ${sortBy === 'date' ? 'active' : ''}`}
                   onClick={() => handleSort('date')}
                 >
                   Date {renderSortIcon('date')}
                 </span>
                 <span 
                   className={`sortable-header ${sortBy === 'payee' ? 'active' : ''}`}
                   onClick={() => handleSort('payee')}
                 >
                   Payee {renderSortIcon('payee')}
                 </span>
                 <span 
                   className={`sortable-header ${sortBy === 'amount' ? 'active' : ''}`}
                   onClick={() => handleSort('amount')}
                   style={{ justifyContent: 'flex-end' }}
                 >
                   Amount {renderSortIcon('amount')}
                 </span>
               </div>
             </div>

             <div className="detail-tx-list">
                {sortedTransactions.length === 0 ? (
                  <div className="empty-state">No transactions in this category yet.</div>
                ) : (
                  <>
                    {visibleTransactions.map(tx => {
                      const isEditing = editingTxId === tx.id;
                      return (
                        <div key={tx.id} className={`detail-tx-row ${isEditing ? 'editing' : ''}`}>
                          {isEditing ? (
                            <TxEditForm
                              tx={tx}
                              onSave={saveEdit}
                              onCancel={() => setEditingTxId(null)}
                              onDelete={handleDeleteTx}
                            />
                          ) : (
                           <>
                             <div className="tx-info" onClick={() => startEditing(tx)}>
                               <span className="tx-date">{new Date(tx.date).toLocaleDateString(undefined, { timeZone: 'UTC' })}</span>
                               <div className="tx-payee-memo">
                                 <span className="tx-payee">{tx.payee}</span>
                                 <span className="tx-memo text-dim">{tx.memo}</span>
                               </div>
                             </div>
                             <div className="tx-actions">
                               <span className={`tx-amount ${tx.amount > 0 ? 'text-success' : ''}`}>
                                 ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                               </span>
                               <div className="tx-row-actions">
                                 <select 
                                   className="reclassify-select"
                                   onChange={(e) => handleReclassify(tx.id, e.target.value)}
                                   value={category.id}
                                 >
                                   <option value={category.id}>Move...</option>
                                   <option value="">Floating (Uncategorized)</option>
                                   {otherCategories.map(c => (
                                     <option key={c.id} value={c.id}>{c.name}</option>
                                   ))}
                                 </select>
                                 <Button size="sm" variant="ghost" onClick={() => setSplittingTxId(tx.id)}>✂️ Split</Button>
                               </div>
                             </div>
                             {splittingTxId === tx.id && (
                               <div className="inline-split-form glass animate-slide-up">
                                 <div className="split-form-row">
                                   <div className="split-input-group">
                                     <label>Amount to move</label>
                                     <Input 
                                       type="number" 
                                       step="0.01" 
                                       value={splitData.amount === 0 ? "" : splitData.amount} 
                                       onChange={e => setSplitData({...splitData, amount: Number(e.target.value)})} 
                                       placeholder="0.00"
                                     />
                                   </div>
                                   <div className="split-input-group">
                                     <label>Target Category</label>
                                     <select 
                                       value={splitData.targetCategoryId} 
                                       onChange={e => setSplitData({...splitData, targetCategoryId: e.target.value})}
                                       className="category-select-sm"
                                     >
                                       <option value="">Floating (Uncategorized)</option>
                                       {otherCategories.map(c => (
                                         <option key={c.id} value={c.id}>{c.name}</option>
                                       ))}
                                     </select>
                                   </div>
                                 </div>
                                 <div className="split-form-actions">
                                   <Button size="sm" onClick={() => handleSplit(tx.id)} disabled={isSaving}>Apply Split</Button>
                                   <Button size="sm" variant="ghost" onClick={() => setSplittingTxId(null)}>Cancel</Button>
                                 </div>
                               </div>
                             )}
                           </>
                         )}
                       </div>
                      );
                    })}
                    {visibleCount < sortedTransactions.length && (
                      <div style={{ padding: "1rem", textAlign: "center" }}>
                        <Button
                          variant="glass"
                          size="sm"
                          onClick={() => setVisibleCount((c) => c + 50)}
                        >
                          Show More ({sortedTransactions.length - visibleCount} remaining)
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
          </Card>
        </div>
      </div>
    </>
  );
}
