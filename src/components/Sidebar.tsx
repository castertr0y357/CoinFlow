"use client";

import { useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { mutate } from "swr";
import { updateAccountExclusion, toggleAccountDebt } from "@/app/categories/actions";
import Button from "@/components/ui/Button";

interface Account {
  id: string;
  name: string;
  balance: number;
  type: string;
  excludeFromSurplus: boolean;
  isDebt: boolean;
}

interface SidebarProps {
  accounts: Account[];
}

export default function Sidebar({ accounts }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleToggleExclusion = async (id: string, current: boolean) => {
    await updateAccountExclusion(id, !current);
    router.refresh();
    mutate('/api/v1/budget/tally');
  };

  const handleToggleDebt = async (id: string, current: boolean) => {
    await toggleAccountDebt(id, !current);
    router.refresh();
    mutate('/api/v1/budget/tally');
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await fetch('/api/v1/sync/simplefin', {
        method: 'POST',
        headers: { 'X-API-KEY': process.env.NEXT_PUBLIC_INTERNAL_API_KEY || '' }
      });
      alert("Bank sync started!");
      router.refresh();
      mutate('/api/v1/budget/tally');
    } catch (error) {
      console.error("Sync Error:", error);
    } finally {
      setIsSyncing(false);
    }
  };



  const groupedAccounts = accounts.reduce((acc, a) => {
    const group = a.excludeFromSurplus ? 'Off Budget' : 'On Budget';
    if (!acc[group]) acc[group] = [];
    acc[group].push(a);
    return acc;
  }, {} as Record<string, Account[]>);

  const navLinks = [
    { label: "Dashboard", href: "/", icon: "📊" },
    { label: "Transactions", href: "/transactions", icon: "💸" },
    { label: "Mortgage", href: "/mortgage", icon: "🏠" },
    { label: "Reports", href: "/reports", icon: "📈" },
    { label: "Commitments", href: "/commitments", icon: "📜" },
    { label: "Settings", href: "/settings", icon: "⚙️" },
  ];

  return (
    <div className="sidebar-container glass">
      <div className="sidebar-header">
        <Link href="/" className="logo-container">
          <img src="/logo.png" alt="CoinFlow Logo" className="logo-icon" />
          <span className="logo-text">CoinFlow</span>
        </Link>
      </div>

      <nav className="sidebar-nav">
        {navLinks.map(link => (
          <Link 
            key={link.href} 
            href={link.href} 
            className={`sidebar-link ${pathname === link.href ? 'active' : ''}`}
          >
            <span className="icon">{link.icon}</span>
            <span className="label">{link.label}</span>
          </Link>
        ))}

        <div className="sidebar-divider"></div>

        <div className="sidebar-actions">
          <button 
            className="sidebar-action-btn" 
            onClick={handleSync}
            disabled={isSyncing}
          >
            <span className="icon">🏦</span>
            <span className="label">{isSyncing ? "Syncing..." : "Sync Banks"}</span>
          </button>

        </div>
      </nav>

      <div className="sidebar-accounts">
        {['On Budget', 'Off Budget'].map(group => {
          const accountsInGroup = groupedAccounts[group] || [];
          if (accountsInGroup.length === 0) return null;

          const assets = accountsInGroup.filter(a => !a.isDebt);
          const debts = accountsInGroup.filter(a => a.isDebt);

          return (
            <div key={group} className="account-section">
              <h4 className="section-label">{group}</h4>
              
              {assets.length > 0 && (
                <div className="account-subgroup">
                  <div className="subgroup-label">Assets</div>
                  <div className="account-links">
                    {assets.map(acc => (
                      <div key={acc.id} className="sidebar-account-item">
                        <div className="account-info">
                          <button 
                            className={`mini-toggle ${acc.excludeFromSurplus ? 'off' : 'on'}`}
                            onClick={() => handleToggleExclusion(acc.id, acc.excludeFromSurplus)}
                            title={acc.excludeFromSurplus ? "Include in Budget" : "Exclude from Budget"}
                          >
                            {acc.excludeFromSurplus ? '✕' : '✓'}
                          </button>
                          <button 
                            className={`mini-toggle debt-toggle ${acc.isDebt ? 'is-debt' : ''}`}
                            onClick={() => handleToggleDebt(acc.id, acc.isDebt)}
                            title={acc.isDebt ? "Mark as Cash" : "Mark as Debt"}
                          >
                            D
                          </button>
                          <span className="account-name">{acc.name}</span>
                        </div>
                        <span className={`account-balance ${acc.balance < 0 ? 'neg' : ''}`}>
                          ${acc.balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {debts.length > 0 && (
                <div className="account-subgroup" style={{ marginTop: assets.length > 0 ? '1rem' : '0' }}>
                  <div className="subgroup-label">Debts</div>
                  <div className="account-links">
                    {debts.map(acc => (
                      <div key={acc.id} className="sidebar-account-item">
                        <div className="account-info">
                          <button 
                            className={`mini-toggle ${acc.excludeFromSurplus ? 'off' : 'on'}`}
                            onClick={() => handleToggleExclusion(acc.id, acc.excludeFromSurplus)}
                            title={acc.excludeFromSurplus ? "Include in Budget" : "Exclude from Budget"}
                          >
                            {acc.excludeFromSurplus ? '✕' : '✓'}
                          </button>
                          <button 
                            className={`mini-toggle debt-toggle ${acc.isDebt ? 'is-debt' : ''}`}
                            onClick={() => handleToggleDebt(acc.id, acc.isDebt)}
                            title={acc.isDebt ? "Mark as Cash" : "Mark as Debt"}
                          >
                            D
                          </button>
                          <span className="account-name">{acc.name}</span>
                        </div>
                        <span className={`account-balance ${acc.balance < 0 ? 'neg' : ''}`}>
                          ${acc.balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <button 
          onClick={async () => {
            await fetch('/api/v1/auth/logout', { method: 'POST' });
            window.location.href = '/login';
          }} 
          className="logout-link"
        >
          <span className="icon">🚪</span>
          <span className="label">Logout</span>
        </button>
      </div>

      <style jsx>{`
        .sidebar-header {
          padding: 1.5rem 1.5rem 2rem;
        }
        .logo-container {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
        }
        .logo-icon {
          width: 32px;
          height: 32px;
          object-fit: contain;
          filter: drop-shadow(0 0 8px rgba(99, 102, 241, 0.4));
        }
        .logo-text {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-family: 'Outfit', sans-serif;
        }
        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding: 0 0.75rem;
        }
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          color: var(--text-dim);
          font-weight: 500;
          transition: var(--transition-fast);
        }
        .sidebar-link:hover, .sidebar-link.active {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-main);
        }
        .sidebar-link.active {
          background: rgba(99, 102, 241, 0.1);
          color: var(--primary);
        }
        .sidebar-divider {
          height: 1px;
          background: var(--glass-border);
          margin: 0.75rem 0.75rem;
          opacity: 0.5;
        }
        .sidebar-actions {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .sidebar-action-btn {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          color: var(--text-dim);
          font-weight: 500;
          transition: var(--transition-fast);
          width: 100%;
          text-align: left;
          background: transparent;
          border: none;
          cursor: pointer;
        }
        .sidebar-action-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-main);
        }
        .sidebar-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .sidebar-accounts {
          margin-top: 2rem;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 0 1.5rem;
        }
        .section-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
          margin-bottom: 0.75rem;
        }

        .sidebar-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--glass-border);
        }
        .logout-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          color: var(--text-muted);
          font-size: 0.85rem;
          width: 100%;
        }
        .logout-link:hover {
          color: var(--danger);
        }
      `}</style>
    </div>
  );
}
