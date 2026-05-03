"use client";

import Card from "@/components/ui/Card";
import { updateAccountExclusion } from "@/app/categories/actions";

interface Account {
  id: string;
  name: string;
  balance: number;
  type: string;
  excludeFromSurplus: boolean;
}

interface AccountBalancesProps {
  accounts: Account[];
}

export default function AccountBalances({ accounts }: AccountBalancesProps) {
  if (accounts.length === 0) return null;

  async function handleToggleExclusion(id: string, current: boolean) {
    await updateAccountExclusion(id, !current);
  }

  // Group accounts by type
  const groups = accounts.reduce((acc, accnt) => {
    const type = accnt.type || 'Other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(accnt);
    return acc;
  }, {} as Record<string, Account[]>);

  // Sort groups: Cash/Checking/Savings first, Credit last
  const sortedTypes = Object.keys(groups).sort((a, b) => {
    const priority: Record<string, number> = {
      'Checking': 1,
      'Savings': 2,
      'Cash': 3,
      'Investment': 4,
      'Credit': 10,
      'Loan': 11,
      'Mortgage': 12
    };
    return (priority[a] || 5) - (priority[b] || 5);
  });

  return (
    <Card className="account-balances-card glass" animate={true} delay="0.2s">
      <div className="section-header">
        <h3>Accounts & Liquidity</h3>
      </div>
      
      <div className="account-groups">
        {sortedTypes.map(type => (
          <div key={type} className="account-group">
            <h4 className="group-label">{type}</h4>
            <div className="account-list">
              {groups[type].map((acc, i) => (
                <div key={i} className={`account-item ${acc.excludeFromSurplus ? 'excluded' : ''}`}>
                  <div className="account-main">
                    <button 
                      className={`exclude-toggle ${acc.excludeFromSurplus ? 'active' : ''}`}
                      onClick={() => handleToggleExclusion(acc.id, acc.excludeFromSurplus)}
                      title={acc.excludeFromSurplus ? "Excluded from Surplus" : "Included in Surplus"}
                    >
                      {acc.excludeFromSurplus ? '⊘' : '○'}
                    </button>
                    <span className="account-name">{acc.name}</span>
                  </div>
                  <span className={`account-balance ${acc.balance < 0 ? 'text-danger' : 'text-success'}`}>
                    ${acc.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
            {type === 'Credit' && (
              <div className="group-footer text-xs text-dim text-right mt-1">
                Total Debt: ${groups[type].reduce((sum, a) => sum + Math.abs(a.balance), 0).toLocaleString()}
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        .account-groups {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin-top: 1rem;
        }
        .group-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-dim);
          margin-bottom: 0.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 0.25rem;
        }
        .account-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .account-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.9rem;
          transition: var(--transition-fast);
        }
        .account-item.excluded {
          opacity: 0.4;
        }
        .account-main {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .exclude-toggle {
          background: none;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          font-size: 1rem;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 1.2rem;
          height: 1.2rem;
          border-radius: 4px;
          transition: var(--transition-fast);
        }
        .exclude-toggle:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-main);
        }
        .exclude-toggle.active {
          color: var(--danger);
        }
        .account-name {
          color: var(--text-main);
          font-weight: 500;
        }
        .account-balance {
          font-weight: 600;
          font-family: 'JetBrains Mono', monospace;
        }
        .text-success { color: #00f2fe; }
        .text-danger { color: #ff4b2b; }
      `}</style>
    </Card>
  );
}
