"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { mutate } from "swr";

interface Account {
  id: string;
  name: string;
  displayName?: string | null;
  balance: number;
  type: string;
  excludeFromSurplus: boolean;
  isDebt: boolean;
  showInSidebar: boolean;
  excludeFromAssetCalculation: boolean;
  showTransactions?: boolean;
}

interface SidebarProps {
  accounts: Account[];
}

export default function Sidebar({ accounts }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);



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



  const totalAssets = accounts
    .filter(a => !a.isDebt && a.showInSidebar && !a.excludeFromAssetCalculation)
    .reduce((sum, a) => sum + a.balance, 0);

  const totalDebts = accounts
    .filter(a => a.isDebt && a.showInSidebar && !a.excludeFromAssetCalculation)
    .reduce((sum, a) => sum + Math.abs(a.balance), 0);

  const groupedAccounts = accounts
    .filter(a => a.showInSidebar)
    .reduce((acc, a) => {
      const group = a.excludeFromSurplus ? 'Off Budget' : 'On Budget';
      if (!acc[group]) acc[group] = [];
      acc[group].push(a);
      return acc;
    }, {} as Record<string, Account[]>);

  const navLinks = [
    { label: "Dashboard", href: "/", icon: "📊" },
    { label: "Transactions", href: "/transactions", icon: "💸" },
    { label: "Goals", href: "/goals", icon: "🎯" },
    { label: "Commitments", href: "/commitments", icon: "📜" },
    { label: "Accounts", href: "/accounts", icon: "💳" },
    { label: "Mortgage", href: "/mortgage", icon: "🏠" },
    { label: "Debts", href: "/debts", icon: "⚖️" },
    { label: "Fire Drill", href: "/fire-drill", icon: "🚨" },
    { label: "Net Worth", href: "/net-worth", icon: "💼" },
    { label: "Reports", href: "/reports", icon: "📈" },
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
        <div className="sidebar-totals glass">
          <div className="totals-row">
            <span className="totals-label">Total Assets</span>
            <span className="totals-value assets-text">
              ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="totals-row">
            <span className="totals-label">Total Debts</span>
            <span className="totals-value debts-text">
              ${totalDebts.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

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
                          <span className="account-name">{acc.displayName || acc.name}</span>
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
                          <span className="account-name">{acc.displayName || acc.name}</span>
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
        .sidebar-totals {
          padding: 0.75rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .totals-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-dim);
        }
        .totals-value {
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          font-size: 0.85rem;
        }
        .totals-value.assets-text {
          color: var(--accent);
        }
        .totals-value.debts-text {
          color: var(--danger);
        }
      `}</style>
    </div>
  );
}
