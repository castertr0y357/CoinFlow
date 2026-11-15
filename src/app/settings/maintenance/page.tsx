import Card from "@/components/ui/Card";
import BackupManager from "../BackupManager";
import HistoricalImporter from "../HistoricalImporter";

export default async function MaintenanceSettingsPage() {
  return (
    <div className="subpage-container animate-fade-in">
      <Card className="settings-form">
        <div className="form-section">
          <h2>Backup &amp; Restore</h2>
          <p className="text-muted">
            Download your entire financial vault, configure automated GFS schedules, or restore from a snapshot.
          </p>
          <BackupManager />
        </div>
      </Card>

      <Card className="settings-form">
        <div className="form-section">
          <h2>Historical XLSX Import</h2>
          <p className="text-muted">
            Ingest transaction data from previous years&apos; spreadsheets.
          </p>
          <HistoricalImporter />
        </div>
      </Card>
    </div>
  );
}
