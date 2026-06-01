"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";

interface ServerBackup {
  filename: string;
  size: number;
  createdAt: string;
}

export default function BackupManager() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState("");
  const [serverBackups, setServerBackups] = useState<ServerBackup[]>([]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const fetchServerBackups = async () => {
    try {
      const res = await fetch("/api/v1/data/backups");
      if (res.ok) {
        const data = await res.json();
        setServerBackups(data.backups || []);
      }
    } catch {}
  };

  useEffect(() => {
    setTimeout(() => {
      fetchServerBackups();
    }, 0);
    
    const handleClickOutside = () => setOpenMenu(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const handleDownloadServerBackup = (filename: string) => {
    window.location.href = `/api/v1/data/backups/${filename}`;
  };

  const handleCreateSnapshot = async () => {
    setIsSyncing(true);
    setStatus("Creating server snapshot...");
    try {
      const res = await fetch("/api/v1/data/backups", { method: "POST" });
      if (res.ok) {
        setStatus("Snapshot created successfully!");
        fetchServerBackups();
      } else {
        setStatus("Failed to create snapshot.");
      }
    } catch {
      setStatus("Error creating snapshot.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("WARNING: This will replace or update existing data. Are you sure?")) return;

    setIsSyncing(true);
    setStatus("Reading backup...");

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      setStatus("Restoring vault...");
      const res = await fetch("/api/v1/data/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backup),
      });

      if (res.ok) {
        setStatus("Success! Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const err = await res.json();
        setStatus(`Error: ${err.error}`);
      }
    } catch {
      setStatus("Error: Invalid JSON file.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleServerRestore = async (filename: string) => {
    if (!confirm(`WARNING: This will replace your current data with the snapshot "${filename}". Are you sure?`)) return;

    setIsSyncing(true);
    setStatus(`Restoring from ${filename}...`);

    try {
      const res = await fetch("/api/v1/data/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });

      if (res.ok) {
        setStatus("Success! Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const err = await res.json();
        setStatus(`Error: ${err.error}`);
      }
    } catch {
      setStatus("Error restoring server snapshot.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="backup-manager">
      <div className="backup-actions">
        <div className="action-row">
          <Button variant="primary" onClick={handleCreateSnapshot} disabled={isSyncing} className="w-full">
            📸 Create Server Snapshot
          </Button>
        </div>
        
        <div className="import-zone mt-4">
          <label className="import-label">
            <span className="icon">📤</span> Restore from Local File
            <input 
              type="file" 
              accept=".json" 
              onChange={handleImport} 
              disabled={isSyncing}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {status && <p className="backup-status animate-fade-in">{status}</p>}

      {serverBackups.length > 0 && (
        <div className="server-backups mt-6">
          <h3>Server Snapshots</h3>
          <div className="backup-list">
            {serverBackups.map((b) => (
              <div key={b.filename} className="backup-item">
                <div className="backup-info">
                  <span className="backup-name">{b.filename}</span>
                  <span className="backup-meta">
                    {new Date(b.createdAt).toLocaleString()} • {(b.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <div className="kebab-menu" onClick={(e) => e.stopPropagation()}>
                  <button 
                    className="kebab-btn"
                    onClick={() => setOpenMenu(openMenu === b.filename ? null : b.filename)}
                  >
                    ⋮
                  </button>
                  {openMenu === b.filename && (
                    <div className="dropdown-menu">
                      <button 
                        className="dropdown-item" 
                        onClick={() => { setOpenMenu(null); handleServerRestore(b.filename); }}
                        disabled={isSyncing}
                      >
                        🔄 Restore
                      </button>
                      <button 
                        className="dropdown-item" 
                        onClick={() => { setOpenMenu(null); handleDownloadServerBackup(b.filename); }}
                      >
                        📥 Download
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .backup-manager {
          margin-top: 1rem;
        }
        .action-row {
          display: flex;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .import-zone {
          border: 2px dashed var(--glass-border);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          transition: all 0.3s ease;
        }
        .import-zone:hover {
          border-color: var(--primary);
          background: rgba(79, 172, 254, 0.05);
        }
        .import-label {
          cursor: pointer;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .backup-status {
          margin-top: 1rem;
          font-size: 0.9rem;
          color: var(--accent);
          text-align: center;
        }
        .server-backups h3 {
          font-size: 1rem;
          margin-bottom: 0.75rem;
          opacity: 0.8;
        }
        .backup-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 250px;
          overflow-y: auto;
          padding-right: 0.5rem;
        }
        .backup-item {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 0.75rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .backup-info {
          display: flex;
          flex-direction: column;
        }
        .backup-name {
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-bright);
        }
        .backup-meta {
          font-size: 0.75rem;
          opacity: 0.6;
        }
        .kebab-menu {
          position: relative;
        }
        .kebab-btn {
          background: none;
          border: none;
          color: var(--text-bright);
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0 0.5rem;
          line-height: 1;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        .kebab-btn:hover {
          opacity: 1;
        }
        .dropdown-menu {
          position: absolute;
          right: 0;
          top: 100%;
          background: rgba(20, 20, 25, 0.95);
          backdrop-filter: blur(10px);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 0.5rem;
          min-width: 130px;
          z-index: 10;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .dropdown-item {
          background: none;
          border: none;
          color: var(--text-bright);
          padding: 0.5rem 1rem;
          text-align: left;
          cursor: pointer;
          border-radius: 4px;
          font-size: 0.85rem;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .dropdown-item:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .dropdown-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
