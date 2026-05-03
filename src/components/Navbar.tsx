"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Navbar() {
  const pathname = usePathname();


  return (
    <nav className="navbar glass">
      <div className="nav-container">
        <Link href="/" className="logo">WebBudget</Link>
        <div className="nav-links">
          <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
            <span className="icon">📊</span>
            <span className="label">Dashboard</span>
          </Link>
          <Link href="/transactions" className={`nav-link ${pathname === '/transactions' ? 'active' : ''}`}>
            <span className="icon">💸</span>
            <span className="label">Inbox</span>
          </Link>
          <Link href="/mortgage" className={`nav-link ${pathname === '/mortgage' ? 'active' : ''}`}>
            <span className="icon">🏠</span>
            <span className="label">Mortgage</span>
          </Link>
          <Link href="/reports" className={`nav-link ${pathname === '/reports' ? 'active' : ''}`}>
            <span className="icon">📈</span>
            <span className="label">Reports</span>
          </Link>
          <Link href="/settings" className={`nav-link ${pathname === '/settings' ? 'active' : ''}`}>
            <span className="icon">⚙️</span>
            <span className="label">Settings</span>
          </Link>
          <button 
            onClick={async () => {
              await fetch('/api/v1/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }} 
            className="nav-link logout-btn"
          >
            <span className="icon">🚪</span>
            <span className="label">Logout</span>
          </button>
        </div>
      </div>
      <style jsx>{`
        .logout-btn {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--danger);
          opacity: 0.7;
          transition: opacity 0.3s ease;
        }
        .logout-btn:hover {
          opacity: 1;
        }
      `}</style>
    </nav>
  );
}
