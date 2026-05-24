"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import Card from "@/components/ui/Card";
import { updateAccountSettings } from "@/app/categories/actions";

interface Account {
  id: string;
  name: string;
  balance: number;
  type: string;
  excludeFromSurplus: boolean;
  isDebt: boolean;
  showInSidebar: boolean;
  excludeFromAssetCalculation: boolean;
}

interface AccountsClientProps {
  initialAccounts: Account[];
}

export default function AccountsClient({ initialAccounts }: AccountsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleUpdate = (id: string, data: any) => {
    startTransition(async () => {
      await updateAccountSettings(id, data);
      router.refresh();
      mutate("/api/v1/budget/tally");
    });
  };

  const startEditing = (acc: Account) => {
    setEditingId(acc.id);
    setEditName(acc.name);
  };

  const saveRename = (id: string) => {
    if (!editName.trim()) return;
    handleUpdate(id, { name: editName.trim() });
    setEditingId(null);
  };

  // Group accounts by Cash/Asset vs Debt
  const assets = initialAccounts.filter(a => !a.isDebt);
  const debts = initialAccounts.filter(a => a.isDebt);

  return (
    <div className={`accounts-client-container ${isPending ? "pending" : ""}`}>
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
          <span className="col-toggle">Exclude from Surplus</span>
          <span className="col-toggle">Is Debt</span>
        </div>

        <div className="accounts-list">
          {assets.map(acc => {
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
                          if (e.key === "Enter") saveRename(acc.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <button className="icon-action-btn save-btn" onClick={() => saveRename(acc.id)} title="Save name">💾</button>
                      <button className="icon-action-btn cancel-btn" onClick={() => setEditingId(null)} title="Cancel">✖</button>
                    </div>
                  ) : (
                    <div className="display-name-group" onClick={() => startEditing(acc)} title="Click to rename account">
                      <span className="account-display-name">{acc.name}</span>
                      <span className="edit-indicator">✏️</span>
                    </div>
                  )}
                  <span className="account-sub-type">{acc.type}</span>
                </div>

                <div className="col-balance font-mono text-success">
                  ${acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    className={`toggle-switch ${acc.excludeFromSurplus ? "active" : ""}`}
                    onClick={() => handleUpdate(acc.id, { excludeFromSurplus: !acc.excludeFromSurplus })}
                    title={acc.excludeFromSurplus ? "Excluded from Surplus (Off Budget). Click to include." : "Included in Surplus (On Budget). Click to exclude."}
                  >
                    {acc.excludeFromSurplus ? "✓" : "✕"}
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
          })}
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
          <span className="col-toggle">Exclude from Surplus</span>
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
                            if (e.key === "Enter") saveRename(acc.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <button className="icon-action-btn save-btn" onClick={() => saveRename(acc.id)} title="Save name">💾</button>
                        <button className="icon-action-btn cancel-btn" onClick={() => setEditingId(null)} title="Cancel">✖</button>
                      </div>
                    ) : (
                      <div className="display-name-group" onClick={() => startEditing(acc)} title="Click to rename account">
                        <span className="account-display-name">{acc.name}</span>
                        <span className="edit-indicator">✏️</span>
                      </div>
                    )}
                    <span className="account-sub-type">{acc.type}</span>
                  </div>

                  <div className="col-balance font-mono text-danger">
                    ${Math.abs(acc.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                      className={`toggle-switch ${acc.excludeFromSurplus ? "active" : ""}`}
                      onClick={() => handleUpdate(acc.id, { excludeFromSurplus: !acc.excludeFromSurplus })}
                      title={acc.excludeFromSurplus ? "Excluded from Surplus (Off Budget). Click to include." : "Included in Surplus (On Budget). Click to exclude."}
                    >
                      {acc.excludeFromSurplus ? "✓" : "✕"}
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
