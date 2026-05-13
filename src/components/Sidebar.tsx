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
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAmazonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch('/api/v1/sync/amazon', {
        method: 'POST',
        headers: { 'X-API-KEY': process.env.NEXT_PUBLIC_INTERNAL_API_KEY || '' },
        body: formData
      });
      const data = await res.json();
      alert(`Amazon sync completed. Imported ${data.count} transactions.`);
      router.refresh();
      mutate('/api/v1/budget/tally');
    } catch (error) {
      console.error("Amazon Sync Error:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
          
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept=".csv"
            onChange={handleFileChange}
          />
          <button 
            className="sidebar-action-btn" 
            onClick={handleAmazonClick}
            disabled={isUploading}
          >
            <span className="icon">📦</span>
            <span className="label">{isUploading ? "Uploading..." : "Amazon CSV"}</span>
          </button>
        </div>
      </nav>

      <div className="sidebar-accounts">
        {['On Budget', 'Off Budget'].map(group => (
          groupedAccounts[group]?.length > 0 && (
            <div key={group} className="account-section">
              <h4 className="section-label">{group}</h4>
              <div className="account-links">
                {groupedAccounts[group].map(acc => (
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
          )
        ))}
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
        .account-links {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .sidebar-account-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.85rem;
          color: var(--text-dim);
        }
        .account-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .mini-toggle {
          width: 14px;
          height: 14px;
          border-radius: 3px;
          border: 1px solid var(--glass-border);
          font-size: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition-fast);
          cursor: pointer;
        }
        .mini-toggle.on {
          background: var(--accent);
          border-color: var(--accent);
          color: white;
        }
        .mini-toggle.off {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-muted);
        }
        .mini-toggle.debt-toggle {
          margin-left: -2px;
          border-left: none;
          border-radius: 0 3px 3px 0;
        }
        .mini-toggle.on:not(.debt-toggle) {
          border-radius: 3px 0 0 3px;
        }
        .mini-toggle.debt-toggle.is-debt {
          background: var(--warning);
          border-color: var(--warning);
          color: black;
          font-weight: 800;
        }
        .account-balance {
          font-family: 'JetBrains Mono', monospace;
          font-weight: 600;
          font-size: 0.8rem;
        }
        .account-balance.neg {
          color: var(--danger);
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
