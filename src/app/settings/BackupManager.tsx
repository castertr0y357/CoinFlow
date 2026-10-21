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

    if (!file.name.endsWith(".sql.gz") && !file.name.endsWith(".sql")) {
      setStatus("Error: Invalid file format. Please select a .sql.gz or .sql file.");
      e.target.value = "";
      return;
    }

    if (!confirm("WARNING: This will replace all existing database data with the dump. Are you sure?")) {
      e.target.value = "";
      return;
    }

    setIsSyncing(true);
    setStatus("Uploading and restoring database dump...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/data/import", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setStatus("Success! Reloading...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        const err = await res.json();
        setStatus(`Error: ${err.error}`);
      }
    } catch {
      setStatus("Error restoring database dump.");
    } finally {
      setIsSyncing(false);
      e.target.value = "";
    }
  };

  const handleServerRestore = async (filename: string) => {
    if (!confirm(`⚠️ RESTORE CONFIRMATION\n\nAre you sure you want to restore to snapshot "${filename}"?\n\nThis will take a pre-restore backup and overwrite your current database.`)) return;
    if (!confirm(`🚨 FINAL CONFIRMATION\n\nProceed with restoring "${filename}"?`)) return;

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

  const handleDeleteServerBackup = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete snapshot "${filename}"?`)) return;

    setIsSyncing(true);
    setStatus(`Deleting snapshot ${filename}...`);

    try {
      const res = await fetch(`/api/v1/data/backups/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setStatus("Snapshot deleted successfully.");
        fetchServerBackups();
      } else {
        const err = await res.json();
        setStatus(`Error: ${err.error}`);
      }
    } catch {
      setStatus("Error deleting snapshot.");
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
            <span className="icon">📤</span> Restore from Local File (.sql.gz)
            <input 
              type="file" 
              accept=".sql.gz,.gz,.sql" 
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
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-gray-200">Server Snapshots History</h3>
            <span className="text-xs text-gray-400">{serverBackups.length} Snapshots</span>
          </div>
          <div className="backup-list">
            {serverBackups.map((b) => (
              <div key={b.filename} className="backup-item">
                <div className="backup-info">
                  <span className="backup-name">{b.filename}</span>
                  <span className="backup-meta">
                    {new Date(b.createdAt).toLocaleString()} • {(b.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <div className="backup-actions-row">
                  {/* ONE-CLICK RESTORE ACTION BUTTON */}
                  <button
                    type="button"
                    onClick={() => handleServerRestore(b.filename)}
                    disabled={isSyncing}
                    className="action-btn restore-btn"
                    title="Restore database to this backup"
                  >
                    🔄 Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadServerBackup(b.filename)}
                    disabled={isSyncing}
                    className="action-btn download-btn"
                    title="Download snapshot archive"
                  >
                    📥 Download
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteServerBackup(b.filename)}
                    disabled={isSyncing}
                    className="action-btn delete-btn"
                    title="Delete snapshot"
                  >
                    🗑️
                  </button>
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
        .backup-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 350px;
          overflow-y: auto;
          padding-right: 0.5rem;
        }
        .backup-item {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
        }
        .backup-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
        }
        .backup-name {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text-bright);
          word-break: break-all;
          font-family: monospace;
        }
        .backup-meta {
          font-size: 0.75rem;
          opacity: 0.6;
          margin-top: 0.2rem;
        }
        .backup-actions-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        .action-btn {
          padding: 0.35rem 0.7rem;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid transparent;
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
        }
        .restore-btn {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.3);
        }
        .restore-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          border-color: rgba(239, 68, 68, 0.5);
        }
        .download-btn {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-bright);
          border-color: var(--glass-border);
        }
        .download-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.12);
        }
        .delete-btn {
          background: transparent;
          color: #9ca3af;
          padding: 0.35rem 0.5rem;
        }
        .delete-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
