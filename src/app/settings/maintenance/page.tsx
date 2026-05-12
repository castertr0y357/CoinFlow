import Card from "@/components/ui/Card";
import YearManager from "../YearManager";
import BackupManager from "../BackupManager";

export default async function MaintenanceSettingsPage() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="subpage-container animate-fade-in">
      <Card className="settings-form">
        <div className="form-section">
          <h2>Year-End Processing</h2>
          <p className="text-muted">Finalize your current year accounting and roll over balances to the next calendar year.</p>
          <YearManager currentYear={currentYear} />
        </div>
      </Card>

      <Card className="settings-form">
        <div className="form-section">
          <h2>Backup & Restore</h2>
          <p className="text-muted">Download your entire financial vault or restore it from a previous backup.</p>
          <BackupManager />
        </div>
      </Card>
    </div>
  );
}
