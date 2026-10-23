"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";

interface ServerBackup {
  id?: string;
  filename: string;
  tier?: string;
  storageType?: string;
  size: number;
  isEncrypted?: boolean;
  status?: string;
  errorMessage?: string | null;
  createdAt: string;
}

interface BackupConfig {
  backupEnabled: boolean;
  backupTime: string;
  backupWeeklyDay: number;
  backupMonthlyDay: number;
  backupKeepDaily: number;
  backupKeepWeekly: number;
  backupKeepMonthly: number;
  backupPreserveConfig: boolean;
  backupStorageType: string;
  backupLocalPath: string;
  backupS3Endpoint?: string;
  backupS3Bucket?: string;
  backupS3Region?: string;
  backupS3AccessKey?: string;
  backupS3SecretKey?: string;
  backupS3Prefix?: string;
  backupCifsServer?: string;
  backupCifsShare?: string;
  backupCifsSubpath?: string;
  backupCifsUsername?: string;
  backupCifsPassword?: string;
  backupCifsDomain?: string;
  backupNfsServer?: string;
  backupNfsExport?: string;
  backupNfsSubpath?: string;
  hasEncryptionPass?: boolean;
  backupEncryptionPass?: string;
  backupWebhookUrl?: string;
}

const WEEKDAY_CHOICES = [
  { code: 0, label: "Sunday" },
  { code: 1, label: "Monday" },
  { code: 2, label: "Tuesday" },
  { code: 3, label: "Wednesday" },
  { code: 4, label: "Thursday" },
  { code: 5, label: "Friday" },
  { code: 6, label: "Saturday" },
];

const STORAGE_CHOICES = [
  { code: "LOCAL", label: "Local Container Volume (/app/backups)" },
  { code: "S3", label: "Amazon S3 / S3-Compatible Object Storage" },
  { code: "CIFS", label: "CIFS / SMB Windows Network Share" },
  { code: "NFS", label: "Direct Userspace NFS Export" },
];

export default function BackupManager() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState("");
  const [storageStatus, setStorageStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [serverBackups, setServerBackups] = useState<ServerBackup[]>([]);
  const [importPassphrase, setImportPassphrase] = useState("");

  // Configuration state
  const [config, setConfig] = useState<BackupConfig>({
    backupEnabled: false,
    backupTime: "02:00",
    backupWeeklyDay: 0,
    backupMonthlyDay: 1,
    backupKeepDaily: 7,
    backupKeepWeekly: 4,
    backupKeepMonthly: 3,
    backupPreserveConfig: true,
    backupStorageType: "LOCAL",
    backupLocalPath: "/app/backups",
    backupS3Region: "us-east-1",
    backupS3Prefix: "coinflow/",
    backupEncryptionPass: "",
    backupWebhookUrl: "",
  });

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/v1/data/backups/config");
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig((prev) => ({ ...prev, ...data.config }));
        }
      }
    } catch {}
  };

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
    fetchConfig();
    fetchServerBackups();
  }, []);

  const handleDownloadServerBackup = (filename: string) => {
    window.location.href = `/api/v1/data/backups/${encodeURIComponent(filename)}`;
  };

  const handleRunBackupNow = async () => {
    setIsSyncing(true);
    setStatus("Initiating manual backup snapshot...");
    try {
      const res = await fetch("/api/v1/data/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "MANUAL" }),
      });
      if (res.ok) {
        setStatus("Backup created successfully!");
        fetchServerBackups();
      } else {
        const err = await res.json().catch(() => ({}));
        setStatus(`Failed to create backup: ${err.error || "Unknown error"}`);
      }
    } catch {
      setStatus("Error executing backup.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    setStatus("Saving automated GFS backup schedule & storage settings...");
    try {
      const res = await fetch("/api/v1/data/backups/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        setStatus("Backup schedule and destination saved successfully!");
      } else {
        const err = await res.json().catch(() => ({}));
        setStatus(`Error saving configuration: ${err.error || "Unknown error"}`);
      }
    } catch {
      setStatus("Error saving backup configuration.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestStorage = async () => {
    setStorageStatus({ message: "Testing storage connection..." });
    try {
      const res = await fetch("/api/v1/data/backups/test-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setStorageStatus({
        success: data.success,
        message: data.message || (data.success ? "Connection verified!" : "Connection failed."),
      });
    } catch (err) {
      setStorageStatus({ success: false, message: "Storage test request failed." });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".sql.gz") && !file.name.endsWith(".sql") && !file.name.endsWith(".enc")) {
      setStatus("Error: Invalid file format. Please select a .sql.gz, .sql, or .enc file.");
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
      if (importPassphrase) {
        formData.append("passphrase", importPassphrase);
      }

      const res = await fetch("/api/v1/data/import", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setStatus("Success! Reloading database state...");
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

  const handleServerRestore = async (filename: string, isEncrypted?: boolean) => {
    let passphrase = "";
    if (isEncrypted) {
      const entered = prompt("This backup is encrypted. Enter the AES-256-GCM passphrase:");
      if (!entered) return;
      passphrase = entered;
    }

    if (!confirm(`⚠️ RESTORE CONFIRMATION\n\nAre you sure you want to restore to snapshot "${filename}"?\n\nThis will take a pre-restore backup and overwrite your current database.`)) return;
    if (!confirm(`🚨 FINAL CONFIRMATION\n\nProceed with restoring "${filename}"?`)) return;

    setIsSyncing(true);
    setStatus(`Restoring from ${filename}...`);

    try {
      const res = await fetch("/api/v1/data/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, passphrase }),
      });

      if (res.ok) {
        setStatus("Success! Reloading database state...");
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
      {/* 1. Quick Actions Row */}
      <div className="quick-actions-grid">
        {/* Instant Export Card */}
        <div className="action-card">
          <div className="action-card-header">
            <span className="action-icon">📥</span>
            <div>
              <h4 className="action-title">INSTANT EXPORT</h4>
              <p className="action-desc">Download fresh compressed database dump (.sql.gz)</p>
            </div>
          </div>
          <a href="/api/v1/data/export" className="action-btn-main primary">
            Download Dump (.sql.gz)
          </a>
        </div>

        {/* Run Backup Now Card */}
        <div className="action-card">
          <div className="action-card-header">
            <span className="action-icon">📸</span>
            <div>
              <h4 className="action-title">RUN BACKUP NOW</h4>
              <p className="action-desc">Snapshot directly to storage ({config.backupStorageType})</p>
            </div>
          </div>
          <Button
            variant="glass"
            onClick={handleRunBackupNow}
            disabled={isSyncing}
            className="w-full font-bold"
          >
            Run Snapshot Now
          </Button>
        </div>

        {/* Restore from File Card */}
        <div className="action-card">
          <div className="action-card-header">
            <span className="action-icon">📤</span>
            <div>
              <h4 className="action-title">RESTORE ARCHIVE</h4>
              <p className="action-desc">Upload .sql.gz, .sql, or .enc file</p>
            </div>
          </div>
          <input
            type="password"
            placeholder="Passphrase (if encrypted)"
            value={importPassphrase}
            onChange={(e) => setImportPassphrase(e.target.value)}
            className="passphrase-input mb-2"
          />
          <label className="file-upload-btn">
            Choose & Restore File
            <input
              type="file"
              accept=".sql.gz,.gz,.sql,.enc"
              onChange={handleImport}
              disabled={isSyncing}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </div>

      {status && <p className="backup-status animate-fade-in">{status}</p>}

      {/* 2. Automated GFS Backup Schedule & Destination Form */}
      <div className="gfs-config-panel mt-6">
        <div className="gfs-header">
          <div className="gfs-title-group">
            <span className="gfs-icon">⚙️</span>
            <div>
              <h3 className="gfs-title">AUTOMATED GFS BACKUP SCHEDULE & DESTINATION</h3>
              <p className="gfs-subtitle">Grandfather-Father-Son rotation policy, multi-target storage, and encryption.</p>
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={config.backupEnabled}
              onChange={(e) => setConfig({ ...config, backupEnabled: e.target.checked })}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">{config.backupEnabled ? "Active Schedule" : "Disabled"}</span>
          </label>
        </div>

        <form onSubmit={handleSaveConfig} className="gfs-form">
          <div className="form-subheading">
            <span>📅 Schedule & GFS Retention Policy</span>
          </div>
          <div className="form-row">
            <div className="form-col">
              <label>Backup Time (UTC)</label>
              <input
                type="text"
                placeholder="02:00"
                value={config.backupTime}
                onChange={(e) => setConfig({ ...config, backupTime: e.target.value })}
                className="input-field"
                required
              />
              <span className="field-hint">24-hour UTC format (HH:MM).</span>
            </div>

            <div className="form-col">
              <label>Weekly Snapshot Day</label>
              <select
                value={config.backupWeeklyDay}
                onChange={(e) => setConfig({ ...config, backupWeeklyDay: Number(e.target.value) })}
                className="select-field"
              >
                {WEEKDAY_CHOICES.map((w) => (
                  <option key={w.code} value={w.code}>{w.label}</option>
                ))}
              </select>
              <span className="field-hint">Day promoted to Weekly tier.</span>
            </div>

            <div className="form-col">
              <label>Monthly Day (1-28)</label>
              <input
                type="number"
                min="1"
                max="28"
                value={config.backupMonthlyDay}
                onChange={(e) => setConfig({ ...config, backupMonthlyDay: Number(e.target.value) })}
                className="input-field"
                required
              />
              <span className="field-hint">Day promoted to Monthly tier.</span>
            </div>

            <div className="form-col gfs-counts-col">
              <label>GFS Retention Counts (D / W / M)</label>
              <div className="counts-group">
                <span className="count-label">D</span>
                <input
                  type="number"
                  min="0"
                  value={config.backupKeepDaily}
                  onChange={(e) => setConfig({ ...config, backupKeepDaily: Number(e.target.value) })}
                  className="input-field small"
                  title="Daily retention count"
                />
                <span className="count-label">W</span>
                <input
                  type="number"
                  min="0"
                  value={config.backupKeepWeekly}
                  onChange={(e) => setConfig({ ...config, backupKeepWeekly: Number(e.target.value) })}
                  className="input-field small"
                  title="Weekly retention count"
                />
                <span className="count-label">M</span>
                <input
                  type="number"
                  min="0"
                  value={config.backupKeepMonthly}
                  onChange={(e) => setConfig({ ...config, backupKeepMonthly: Number(e.target.value) })}
                  className="input-field small"
                  title="Monthly retention count"
                />
              </div>
              <span className="field-hint">Retain Daily, Weekly, and Monthly snapshots.</span>
            </div>
          </div>

          {/* Storage Destination Section */}
          <div className="form-subheading mt-4">
            <span>💾 Storage Destination Target</span>
          </div>
          <div className="form-row">
            <div className="form-col full-width">
              <label>Destination Target</label>
              <select
                value={config.backupStorageType}
                onChange={(e) => setConfig({ ...config, backupStorageType: e.target.value })}
                className="select-field"
              >
                {STORAGE_CHOICES.map((s) => (
                  <option key={s.code} value={s.code}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {config.backupStorageType === "LOCAL" && (
            <div className="form-row mt-2">
              <div className="form-col full-width">
                <label>Container Directory Path</label>
                <input
                  type="text"
                  value={config.backupLocalPath}
                  onChange={(e) => setConfig({ ...config, backupLocalPath: e.target.value })}
                  className="input-field"
                />
                <span className="field-hint">Mounted persistent volume directory (default: /app/backups).</span>
              </div>
            </div>
          )}

          {config.backupStorageType === "S3" && (
            <div className="form-grid-3 mt-2">
              <div className="form-col">
                <label>S3 Bucket</label>
                <input
                  type="text"
                  value={config.backupS3Bucket || ""}
                  onChange={(e) => setConfig({ ...config, backupS3Bucket: e.target.value })}
                  className="input-field"
                  placeholder="my-backup-bucket"
                />
              </div>
              <div className="form-col">
                <label>Region</label>
                <input
                  type="text"
                  value={config.backupS3Region || "us-east-1"}
                  onChange={(e) => setConfig({ ...config, backupS3Region: e.target.value })}
                  className="input-field"
                  placeholder="us-east-1"
                />
              </div>
              <div className="form-col">
                <label>Prefix / Folder</label>
                <input
                  type="text"
                  value={config.backupS3Prefix || "coinflow/"}
                  onChange={(e) => setConfig({ ...config, backupS3Prefix: e.target.value })}
                  className="input-field"
                  placeholder="coinflow/"
                />
              </div>
              <div className="form-col">
                <label>Access Key ID</label>
                <input
                  type="text"
                  value={config.backupS3AccessKey || ""}
                  onChange={(e) => setConfig({ ...config, backupS3AccessKey: e.target.value })}
                  className="input-field"
                  placeholder="AKIA..."
                />
              </div>
              <div className="form-col">
                <label>Secret Access Key</label>
                <input
                  type="password"
                  value={config.backupS3SecretKey || ""}
                  onChange={(e) => setConfig({ ...config, backupS3SecretKey: e.target.value })}
                  className="input-field"
                  placeholder="••••••••"
                />
              </div>
              <div className="form-col">
                <label>Custom Endpoint URL (Optional)</label>
                <input
                  type="url"
                  value={config.backupS3Endpoint || ""}
                  onChange={(e) => setConfig({ ...config, backupS3Endpoint: e.target.value })}
                  className="input-field"
                  placeholder="https://minio.local or Cloudflare R2"
                />
              </div>
            </div>
          )}

          {config.backupStorageType === "CIFS" && (
            <div className="form-grid-3 mt-2">
              <div className="form-col">
                <label>SMB Server Host / IP</label>
                <input
                  type="text"
                  value={config.backupCifsServer || ""}
                  onChange={(e) => setConfig({ ...config, backupCifsServer: e.target.value })}
                  className="input-field"
                  placeholder="192.168.1.100 or nas.local"
                />
              </div>
              <div className="form-col">
                <label>Share Name</label>
                <input
                  type="text"
                  value={config.backupCifsShare || ""}
                  onChange={(e) => setConfig({ ...config, backupCifsShare: e.target.value })}
                  className="input-field"
                  placeholder="backups"
                />
              </div>
              <div className="form-col">
                <label>Subfolder Path (Optional)</label>
                <input
                  type="text"
                  value={config.backupCifsSubpath || ""}
                  onChange={(e) => setConfig({ ...config, backupCifsSubpath: e.target.value })}
                  className="input-field"
                  placeholder="coinflow"
                />
              </div>
              <div className="form-col">
                <label>Username</label>
                <input
                  type="text"
                  value={config.backupCifsUsername || ""}
                  onChange={(e) => setConfig({ ...config, backupCifsUsername: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="form-col">
                <label>Password</label>
                <input
                  type="password"
                  value={config.backupCifsPassword || ""}
                  onChange={(e) => setConfig({ ...config, backupCifsPassword: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="form-col">
                <label>Workgroup / Domain (Optional)</label>
                <input
                  type="text"
                  value={config.backupCifsDomain || ""}
                  onChange={(e) => setConfig({ ...config, backupCifsDomain: e.target.value })}
                  className="input-field"
                  placeholder="WORKGROUP"
                />
              </div>
            </div>
          )}

          {config.backupStorageType === "NFS" && (
            <div className="form-grid-3 mt-2">
              <div className="form-col">
                <label>NFS Server Host / IP</label>
                <input
                  type="text"
                  value={config.backupNfsServer || ""}
                  onChange={(e) => setConfig({ ...config, backupNfsServer: e.target.value })}
                  className="input-field"
                  placeholder="192.168.1.150 or nfs.local"
                />
              </div>
              <div className="form-col">
                <label>Export Path</label>
                <input
                  type="text"
                  value={config.backupNfsExport || ""}
                  onChange={(e) => setConfig({ ...config, backupNfsExport: e.target.value })}
                  className="input-field"
                  placeholder="/volume1/backups"
                />
              </div>
              <div className="form-col">
                <label>Subfolder (Optional)</label>
                <input
                  type="text"
                  value={config.backupNfsSubpath || ""}
                  onChange={(e) => setConfig({ ...config, backupNfsSubpath: e.target.value })}
                  className="input-field"
                  placeholder="coinflow"
                />
              </div>
            </div>
          )}

          {/* Security & Failure Alerts Section */}
          <div className="form-subheading mt-4">
            <span>🔒 Security & Failure Alerts</span>
          </div>
          <div className="form-grid-3">
            <div className="form-col">
              <label>Encryption Passphrase (Optional)</label>
              <input
                type="password"
                value={config.backupEncryptionPass || ""}
                onChange={(e) => setConfig({ ...config, backupEncryptionPass: e.target.value })}
                className="input-field"
                placeholder={config.hasEncryptionPass ? "(Passphrase set - leave empty to keep)" : "AES-256-GCM Passphrase"}
              />
              <span className="field-hint">Encrypts snapshots with AES-256-GCM before storage transmission.</span>
            </div>

            <div className="form-col">
              <label>Failure Webhook URL (Optional)</label>
              <input
                type="url"
                value={config.backupWebhookUrl || ""}
                onChange={(e) => setConfig({ ...config, backupWebhookUrl: e.target.value })}
                className="input-field"
                placeholder="https://discord.com/api/webhooks/..."
              />
              <span className="field-hint">Discord, Slack, or Gotify webhook for alert notifications.</span>
            </div>

            <div className="form-col flex-center pt-3">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.backupPreserveConfig}
                  onChange={(e) => setConfig({ ...config, backupPreserveConfig: e.target.checked })}
                />
                <span>Preserve Schedule on Database Restore</span>
              </label>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="gfs-footer mt-4 pt-3">
            <div className="storage-test-group">
              <button
                type="button"
                onClick={handleTestStorage}
                disabled={isSyncing}
                className="test-btn"
              >
                🔍 Test Connection
              </button>
              {storageStatus && (
                <span className={`test-status ${storageStatus.success ? "success" : "failed"}`}>
                  {storageStatus.message}
                </span>
              )}
            </div>
            <Button variant="primary" type="submit" disabled={isSyncing}>
              💾 Save Backup Schedule & Destination
            </Button>
          </div>
        </form>
      </div>

      {/* 3. Snapshots Catalog Table */}
      <div className="catalog-panel mt-6">
        <div className="catalog-header">
          <div className="catalog-title-group">
            <span className="catalog-icon">📦</span>
            <div>
              <h3 className="catalog-title">BACKUP SNAPSHOT CATALOG</h3>
              <p className="catalog-subtitle">Local storage and remote GFS tiered snapshots.</p>
            </div>
          </div>
          <span className="catalog-count-badge">{serverBackups.length} Snapshots</span>
        </div>

        {serverBackups.length === 0 ? (
          <p className="empty-catalog">No backup snapshots found in catalog.</p>
        ) : (
          <div className="table-wrapper">
            <table className="catalog-table">
              <thead>
                <tr>
                  <th>TIMESTAMP</th>
                  <th>SNAPSHOT FILE</th>
                  <th>TIER</th>
                  <th>STORAGE</th>
                  <th>SIZE</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {serverBackups.map((b) => (
                  <tr key={b.filename}>
                    <td className="time-col">{new Date(b.createdAt).toLocaleString()}</td>
                    <td className="name-col">
                      <span className="file-name">{b.filename}</span>
                      {b.isEncrypted && (
                        <span className="encrypted-badge" title="Encrypted with AES-256-GCM">🔒</span>
                      )}
                    </td>
                    <td>
                      <span className={`tier-badge ${(b.tier || "MANUAL").toLowerCase()}`}>
                        {b.tier || "MANUAL"}
                      </span>
                    </td>
                    <td className="storage-col">{b.storageType || "LOCAL"}</td>
                    <td className="size-col">{(b.size / 1024).toFixed(1)} KB</td>
                    <td>
                      <span className={`status-pill ${b.status === "FAILED" ? "failed" : "success"}`}>
                        {b.status || "SUCCESS"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row-actions">
                        <button
                          type="button"
                          onClick={() => handleServerRestore(b.filename, b.isEncrypted)}
                          disabled={isSyncing}
                          className="action-btn restore-btn"
                          title="Restore database from snapshot"
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .backup-manager {
          margin-top: 0.5rem;
        }

        .quick-actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
        }
        .action-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .action-card-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .action-icon {
          font-size: 1.5rem;
        }
        .action-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-bright);
          letter-spacing: 0.05em;
          margin: 0;
        }
        .action-desc {
          font-size: 0.75rem;
          color: var(--text-dim);
          margin: 0.2rem 0 0 0;
        }
        .action-btn-main {
          display: block;
          text-align: center;
          padding: 0.6rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
        }
        .action-btn-main.primary {
          background: var(--primary);
          color: #fff;
        }
        .action-btn-main.primary:hover {
          filter: brightness(1.1);
        }
        .file-upload-btn {
          display: block;
          text-align: center;
          padding: 0.6rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          background: rgba(234, 179, 8, 0.2);
          color: #facc15;
          border: 1px solid rgba(234, 179, 8, 0.4);
          cursor: pointer;
          transition: all 0.2s;
        }
        .file-upload-btn:hover {
          background: rgba(234, 179, 8, 0.3);
        }
        .passphrase-input {
          width: 100%;
          padding: 0.4rem 0.6rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          color: var(--text-bright);
          font-size: 0.8rem;
          outline: none;
        }

        .backup-status {
          margin-top: 1rem;
          font-size: 0.9rem;
          color: var(--accent);
          text-align: center;
        }

        /* GFS Panel */
        .gfs-config-panel {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 1.5rem;
        }
        .gfs-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 1.25rem;
        }
        .gfs-title-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .gfs-icon {
          font-size: 1.5rem;
        }
        .gfs-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-bright);
          margin: 0;
          letter-spacing: 0.05em;
        }
        .gfs-subtitle {
          font-size: 0.75rem;
          color: var(--text-dim);
          margin: 0.2rem 0 0 0;
        }

        .toggle-switch {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }
        .toggle-switch input {
          display: none;
        }
        .toggle-slider {
          width: 40px;
          height: 22px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          position: relative;
          transition: background 0.3s;
        }
        .toggle-slider::before {
          content: "";
          position: absolute;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: white;
          top: 3px;
          left: 3px;
          transition: transform 0.3s;
        }
        .toggle-switch input:checked + .toggle-slider {
          background: var(--primary);
        }
        .toggle-switch input:checked + .toggle-slider::before {
          transform: translateX(18px);
        }
        .toggle-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-bright);
        }

        .form-subheading {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--primary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.75rem;
        }
        .form-row {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .form-col {
          flex: 1;
          min-width: 140px;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .form-col.full-width {
          flex: 1 1 100%;
        }
        .form-col.gfs-counts-col {
          flex: 1.5;
        }
        .form-col label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-dim);
        }
        .field-hint {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.4);
        }
        .input-field, .select-field {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          padding: 0.5rem 0.75rem;
          color: var(--text-bright);
          font-size: 0.85rem;
          outline: none;
        }
        .input-field.small {
          width: 55px;
          text-align: center;
        }
        .counts-group {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .count-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-dim);
          background: rgba(255, 255, 255, 0.05);
          padding: 0.45rem 0.6rem;
          border-radius: 6px;
          border: 1px solid var(--glass-border);
        }

        .form-grid-3 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: var(--text-bright);
          cursor: pointer;
        }

        .gfs-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .storage-test-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .test-btn {
          background: transparent;
          border: 1px solid var(--glass-border);
          color: var(--text-bright);
          padding: 0.45rem 0.85rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .test-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--primary);
        }
        .test-status {
          font-size: 0.75rem;
          font-weight: 600;
        }
        .test-status.success {
          color: #4ade80;
        }
        .test-status.failed {
          color: #f87171;
        }

        /* Catalog Panel */
        .catalog-panel {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 1.5rem;
        }
        .catalog-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.25rem;
        }
        .catalog-title-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .catalog-icon {
          font-size: 1.5rem;
        }
        .catalog-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-bright);
          margin: 0;
          letter-spacing: 0.05em;
        }
        .catalog-subtitle {
          font-size: 0.75rem;
          color: var(--text-dim);
          margin: 0.2rem 0 0 0;
        }
        .catalog-count-badge {
          font-size: 0.75rem;
          color: var(--text-dim);
          background: rgba(255, 255, 255, 0.05);
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
          border: 1px solid var(--glass-border);
        }

        .empty-catalog {
          text-align: center;
          font-size: 0.85rem;
          color: var(--text-dim);
          padding: 2rem 0;
        }
        .table-wrapper {
          overflow-x: auto;
        }
        .catalog-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }
        .catalog-table th {
          text-align: left;
          padding: 0.6rem 0.75rem;
          color: var(--text-dim);
          font-weight: 600;
          font-size: 0.7rem;
          letter-spacing: 0.05em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .catalog-table td {
          padding: 0.75rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          color: var(--text-bright);
        }
        .time-col {
          color: var(--text-dim);
          white-space: nowrap;
        }
        .name-col {
          font-family: monospace;
          font-size: 0.8rem;
          word-break: break-all;
        }
        .encrypted-badge {
          margin-left: 0.4rem;
          font-size: 0.75rem;
        }
        .tier-badge {
          display: inline-block;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        .tier-badge.manual {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }
        .tier-badge.daily {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
        }
        .tier-badge.weekly {
          background: rgba(168, 85, 247, 0.15);
          color: #c084fc;
        }
        .tier-badge.monthly {
          background: rgba(234, 179, 8, 0.15);
          color: #facc15;
        }
        .status-pill {
          display: inline-block;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 700;
        }
        .status-pill.success {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
        }
        .status-pill.failed {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        .row-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.4rem;
        }
        .action-btn {
          padding: 0.3rem 0.6rem;
          font-size: 0.75rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid transparent;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        }
        .restore-btn {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.3);
        }
        .restore-btn:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.3);
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
        }
        .delete-btn:hover:not(:disabled) {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }
        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
