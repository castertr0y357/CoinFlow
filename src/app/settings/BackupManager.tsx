"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

export default function BackupManager() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState("");

  const handleExport = () => {
    window.location.href = "/api/v1/data/export";
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
    } catch (err) {
      setStatus("Error: Invalid JSON file.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="backup-manager">
      <div className="backup-actions">
        <Button variant="secondary" onClick={handleExport} className="w-full mb-4">
          📥 Export Data Vault (.json)
        </Button>
        
        <div className="import-zone">
          <label className="import-label">
            <span className="icon">📤</span> Restore from Backup
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

      <style jsx>{`
        .backup-manager {
          margin-top: 1rem;
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
      `}</style>
    </div>
  );
}
