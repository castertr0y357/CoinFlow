"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { updateAccountSettings, createManualAccountAction, deleteAccountAction } from "@/app/categories/actions";

interface Account {
  id: string;
  name: string;
  displayName: string | null;
  balance: number;
  type: string;
  excludeFromSurplus: boolean;
  isDebt: boolean;
  showInSidebar: boolean;
  excludeFromAssetCalculation: boolean;
  showTransactions: boolean;
  isManual: boolean;
}

interface AccountsClientProps {
  initialAccounts: Account[];
}

interface AccountSettingsUpdate {
  name?: string;
  displayName?: string | null;
  showInSidebar?: boolean;
  excludeFromAssetCalculation?: boolean;
  excludeFromSurplus?: boolean;
  isDebt?: boolean;
  showTransactions?: boolean;
  balance?: number;
}

export default function AccountsClient({ initialAccounts }: AccountsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBalance, setEditBalance] = useState("");

  const [isAdding, setIsAdding] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    balance: "",
    isDebt: false,
    interestRate: "",
    minimumPayment: "",
    remainingPayments: ""
  });

  const handleUpdate = (id: string, data: AccountSettingsUpdate) => {
    startTransition(async () => {
      await updateAccountSettings(id, data);
      router.refresh();
      mutate("/api/v1/budget/tally");
    });
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.name || !addForm.balance) return;

    startTransition(async () => {
      await createManualAccountAction({
        name: addForm.name,
        balance: Number(addForm.balance),
        isDebt: addForm.isDebt,
        interestRate: addForm.isDebt && addForm.interestRate ? Number(addForm.interestRate) : undefined,
        minimumPayment: addForm.isDebt && addForm.minimumPayment ? Number(addForm.minimumPayment) : undefined,
        remainingPayments: addForm.isDebt && addForm.remainingPayments ? Number(addForm.remainingPayments) : undefined,
      });

      setAddForm({
        name: "",
        balance: "",
        isDebt: false,
        interestRate: "",
        minimumPayment: "",
        remainingPayments: ""
      });
      setIsAdding(false);
      router.refresh();
      mutate("/api/v1/budget/tally");
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this manual account? This will permanently delete the account, its balance, and any associated details or transaction splits.")) {
      startTransition(async () => {
        await deleteAccountAction(id);
        router.refresh();
        mutate("/api/v1/budget/tally");
      });
    }
  };

  const startEditing = (acc: Account) => {
    setEditingId(acc.id);
    setEditName(acc.displayName || acc.name);
    setEditBalance(Math.abs(acc.balance).toString());
  };

  const saveEdit = (id: string, isManual: boolean) => {
    const updateData: AccountSettingsUpdate = { displayName: editName.trim() || null };
    if (isManual) {
      const balanceNum = Number(editBalance);
      if (!isNaN(balanceNum)) {
        updateData.balance = balanceNum;
      }
    }
    handleUpdate(id, updateData);
    setEditingId(null);
  };

  // Group accounts by Cash/Asset vs Debt
  const assets = initialAccounts.filter(a => !a.isDebt);
  const debts = initialAccounts.filter(a => a.isDebt);

  return (
    <div className={`accounts-client-container ${isPending ? "pending" : ""}`}>
      {/* Add Manual Account Button & Form */}
      <div className="accounts-actions-header mb-6">
        <Button variant="primary" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? "✕ Close Form" : "＋ Add Manual Account"}
        </Button>
      </div>

      {isAdding && (
        <Card className="add-account-card glass mb-8 animate-slide-up">
          <h3>Create a New Manual Account</h3>
          <form onSubmit={handleAddAccount} className="account-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Account Name</label>
                <input 
                  type="text" 
                  value={addForm.name} 
                  onChange={e => setAddForm({ ...addForm, name: e.target.value })} 
                  placeholder="e.g. Solar Panel Loan, Cash Safe" 
                  required 
                />
              </div>
              
              <div className="form-group">
                <label>Starting Balance ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  value={addForm.balance} 
                  onChange={e => setAddForm({ ...addForm, balance: e.target.value })} 
                  placeholder="e.g. 15000" 
                  required 
                />
              </div>
            </div>

            <div className="form-grid checkbox-grid mt-4 mb-4">
              <div className="form-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={addForm.isDebt} 
                    onChange={e => setAddForm({ ...addForm, isDebt: e.target.checked })} 
                  />
                  <span>This is a Debt / Liability account (e.g. loan, credit card)</span>
                </label>
              </div>
            </div>

            {addForm.isDebt && (
              <div className="form-grid three-col-grid animate-fade-in">
                <div className="form-group">
                  <label>Interest Rate (APR %)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={addForm.interestRate} 
                    onChange={e => setAddForm({ ...addForm, interestRate: e.target.value })} 
                    placeholder="e.g. 4.99" 
                  />
                </div>

                <div className="form-group">
                  <label>Minimum Monthly Payment ($)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={addForm.minimumPayment} 
                    onChange={e => setAddForm({ ...addForm, minimumPayment: e.target.value })} 
                    placeholder="e.g. 150" 
                  />
                </div>

                <div className="form-group">
                  <label>Remaining Payments (Months)</label>
                  <input 
                    type="number" 
                    step="1"
                    min="0"
                    value={addForm.remainingPayments} 
                    onChange={e => setAddForm({ ...addForm, remainingPayments: e.target.value })} 
                    placeholder="e.g. 60" 
                  />
                </div>
              </div>
            )}

            <div className="form-actions mt-6">
              <Button type="submit" variant="primary">Add Account</Button>
              <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Assets Section */}
      <Card className="accounts-settings-card glass mb-8 animate-fade-in">
        <div className="card-header-with-badge">
          <h3>Asset Accounts</h3>
          <span className="badge assets-badge">Assets</span>
        </div>
        
        <div className="accounts-table-header">
          <span className="col-name">Account Name</span>
          <span className="col-balance">Balance</span>
          <span className="col-toggle">Show in Sidebar</span>
          <span className="col-toggle">Include in Net Worth</span>
          <span className="col-toggle">Show Transactions</span>
          <span className="col-toggle">On Budget</span>
          <span className="col-toggle">Is Debt</span>
        </div>

        <div className="accounts-list">
          {assets.length === 0 ? (
            <div className="empty-state text-dim py-8 text-center">No asset accounts registered.</div>
          ) : (
            assets.map(acc => {
              const isEditing = editingId === acc.id;
              return (
                <div key={acc.id} className="account-row-item">
                  <div className="col-name name-edit-cell">
                    {isEditing ? (
                      <div className="edit-input-group" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="rename-input"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(acc.id, acc.isManual);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button className="icon-action-btn save-btn" onClick={() => saveEdit(acc.id, acc.isManual)} title="Save name">💾</button>
                        <button className="icon-action-btn cancel-btn" onClick={() => setEditingId(null)} title="Cancel">✖</button>
                      </div>
                    ) : (
                      <div className="display-name-group-wrapper">
                        <div className="display-name-group" onClick={() => startEditing(acc)} title={acc.isManual ? "Click to edit name and balance" : "Click to rename account"}>
                          <span className="account-display-name">{acc.displayName || acc.name}</span>
                          <span className="edit-indicator">✏️</span>
                        </div>
                        {acc.isManual && (
                          <button 
                            className="icon-action-btn delete-account-btn" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(acc.id);
                            }}
                            title="Delete manual account"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    )}
                    <span className="account-sub-type">
                      {acc.type}{acc.displayName ? ` (${acc.name})` : ""}{acc.isManual ? " [Manual]" : ""}
                    </span>
                  </div>

                  <div className="col-balance font-mono text-success">
                    {isEditing && acc.isManual ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editBalance}
                        onChange={(e) => setEditBalance(e.target.value)}
                        className="rename-input balance-input"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(acc.id, acc.isManual);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                    ) : (
                      `$${acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                  </div>

                  <div className="col-toggle">
                    <button
                      className={`toggle-switch ${acc.showInSidebar ? "active" : ""}`}
                      onClick={() => handleUpdate(acc.id, { showInSidebar: !acc.showInSidebar })}
                      title={acc.showInSidebar ? "Currently visible in sidebar. Click to hide." : "Currently hidden in sidebar. Click to show."}
                    >
                      {acc.showInSidebar ? "✓" : "✕"}
                    </button>
                  </div>

                  <div className="col-toggle">
                    <button
                      className={`toggle-switch ${!acc.excludeFromAssetCalculation ? "active" : ""}`}
                      onClick={() => handleUpdate(acc.id, { excludeFromAssetCalculation: !acc.excludeFromAssetCalculation })}
                      title={!acc.excludeFromAssetCalculation ? "Included in Net Worth. Click to exclude." : "Excluded from Net Worth. Click to include."}
                    >
                      {!acc.excludeFromAssetCalculation ? "✓" : "✕"}
                    </button>
                  </div>

                  <div className="col-toggle">
                    <button
                      className={`toggle-switch ${acc.showTransactions ? "active" : ""}`}
                      onClick={() => handleUpdate(acc.id, { showTransactions: !acc.showTransactions })}
                      title={acc.showTransactions ? "Transactions visible. Click to hide." : "Transactions hidden. Click to show."}
                    >
                      {acc.showTransactions ? "✓" : "✕"}
                    </button>
                  </div>

                  <div className="col-toggle">
                    <button
                      className={`toggle-switch ${acc.showInSidebar && !acc.excludeFromSurplus ? "active" : ""}`}
                      onClick={() => handleUpdate(acc.id, { excludeFromSurplus: !acc.excludeFromSurplus })}
                      disabled={!acc.showInSidebar}
                      title={!acc.showInSidebar ? "Must show in sidebar to include on budget." : (acc.showInSidebar && !acc.excludeFromSurplus ? "On Budget. Click to mark Off Budget." : "Off Budget. Click to mark On Budget.")}
                    >
                      {acc.showInSidebar && !acc.excludeFromSurplus ? "✓" : "✕"}
                    </button>
                  </div>

                  <div className="col-toggle">
                    <button
                      className={`toggle-switch ${acc.isDebt ? "active" : ""}`}
                      onClick={() => handleUpdate(acc.id, { isDebt: !acc.isDebt })}
                      title={acc.isDebt ? "Classified as Debt. Click to mark as Cash/Asset." : "Classified as Cash/Asset. Click to mark as Debt."}
                    >
                      {acc.isDebt ? "✓" : "✕"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Debts Section */}
      <Card className="accounts-settings-card glass animate-fade-in" style={{ animationDelay: "0.1s" }}>
        <div className="card-header-with-badge">
          <h3>Debt Accounts</h3>
          <span className="badge debts-badge">Debts</span>
        </div>

        <div className="accounts-table-header">
          <span className="col-name">Account Name</span>
          <span className="col-balance">Balance</span>
          <span className="col-toggle">Show in Sidebar</span>
          <span className="col-toggle">Include in Net Worth</span>
          <span className="col-toggle">Show Transactions</span>
          <span className="col-toggle">On Budget</span>
          <span className="col-toggle">Is Debt</span>
        </div>

        <div className="accounts-list">
          {debts.length === 0 ? (
            <div className="empty-state text-dim py-8 text-center">No debt accounts registered.</div>
          ) : (
            debts.map(acc => {
              const isEditing = editingId === acc.id;
              return (
                <div key={acc.id} className="account-row-item">
                  <div className="col-name name-edit-cell">
                    {isEditing ? (
                      <div className="edit-input-group" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="rename-input"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(acc.id, acc.isManual);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button className="icon-action-btn save-btn" onClick={() => saveEdit(acc.id, acc.isManual)} title="Save name">💾</button>
                        <button className="icon-action-btn cancel-btn" onClick={() => setEditingId(null)} title="Cancel">✖</button>
                      </div>
                    ) : (
                      <div className="display-name-group-wrapper">
                        <div className="display-name-group" onClick={() => startEditing(acc)} title={acc.isManual ? "Click to edit name and balance" : "Click to rename account"}>
                          <span className="account-display-name">{acc.displayName || acc.name}</span>
                          <span className="edit-indicator">✏️</span>
                        </div>
                        {acc.isManual && (
                          <button 
                            className="icon-action-btn delete-account-btn" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(acc.id);
                            }}
                            title="Delete manual account"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    )}
                    <span className="account-sub-type">
                      {acc.type}{acc.displayName ? ` (${acc.name})` : ""}{acc.isManual ? " [Manual]" : ""}
                    </span>
                  </div>

                  <div className="col-balance font-mono text-danger">
                    {isEditing && acc.isManual ? (
                      <input
                        type="number"
                        step="0.01"
                        value={editBalance}
                        onChange={(e) => setEditBalance(e.target.value)}
                        className="rename-input balance-input"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(acc.id, acc.isManual);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                    ) : (
                      `$${Math.abs(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                  </div>

                  <div className="col-toggle">
                    <button
                      className={`toggle-switch ${acc.showInSidebar ? "active" : ""}`}
                      onClick={() => handleUpdate(acc.id, { showInSidebar: !acc.showInSidebar })}
                      title={acc.showInSidebar ? "Currently visible in sidebar. Click to hide." : "Currently hidden in sidebar. Click to show."}
                    >
                      {acc.showInSidebar ? "✓" : "✕"}
                    </button>
                  </div>

                  <div className="col-toggle">
                    <button
                      className={`toggle-switch ${!acc.excludeFromAssetCalculation ? "active" : ""}`}
                      onClick={() => handleUpdate(acc.id, { excludeFromAssetCalculation: !acc.excludeFromAssetCalculation })}
                      title={!acc.excludeFromAssetCalculation ? "Included in Net Worth. Click to exclude." : "Excluded from Net Worth. Click to include."}
                    >
                      {!acc.excludeFromAssetCalculation ? "✓" : "✕"}
                    </button>
                  </div>

                  <div className="col-toggle">
                    <button
                      className={`toggle-switch ${acc.showTransactions ? "active" : ""}`}
                      onClick={() => handleUpdate(acc.id, { showTransactions: !acc.showTransactions })}
                      title={acc.showTransactions ? "Transactions visible. Click to hide." : "Transactions hidden. Click to show."}
                    >
                      {acc.showTransactions ? "✓" : "✕"}
                    </button>
                  </div>

                  <div className="col-toggle">
                    <button
                      className={`toggle-switch ${acc.showInSidebar && !acc.excludeFromSurplus ? "active" : ""}`}
                      onClick={() => handleUpdate(acc.id, { excludeFromSurplus: !acc.excludeFromSurplus })}
                      disabled={!acc.showInSidebar}
                      title={!acc.showInSidebar ? "Must show in sidebar to include on budget." : (acc.showInSidebar && !acc.excludeFromSurplus ? "On Budget. Click to mark Off Budget." : "Off Budget. Click to mark On Budget.")}
                    >
                      {acc.showInSidebar && !acc.excludeFromSurplus ? "✓" : "✕"}
                    </button>
                  </div>

                  <div className="col-toggle">
                    <button
                      className={`toggle-switch ${acc.isDebt ? "active" : ""}`}
                      onClick={() => handleUpdate(acc.id, { isDebt: !acc.isDebt })}
                      title={acc.isDebt ? "Classified as Debt. Click to mark as Cash/Asset." : "Classified as Cash/Asset. Click to mark as Debt."}
                    >
                      {acc.isDebt ? "✓" : "✕"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>
    </div>
  );
}
