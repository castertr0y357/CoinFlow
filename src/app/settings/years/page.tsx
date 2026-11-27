import Card from "@/components/ui/Card";
import { getHistoricalYearSummaries } from "@/lib/services/yearService";
import HistoricalArchivesList from "./HistoricalArchivesList";
import HistoricalImporter from "../HistoricalImporter";
import YearManager from "../YearManager";

export default async function YearsSettingsPage() {
  const currentYear = new Date().getFullYear();
  const pastYears = await getHistoricalYearSummaries(currentYear);

  return (
    <div className="subpage-container animate-fade-in">
      <Card className="settings-form">
        <div className="form-section">
          <h2>Historical Archives</h2>
          <p className="text-muted">
            Inspect finalized budgets from previous years or remove an archived year if you need to re-import it.
          </p>
          <HistoricalArchivesList initialYears={pastYears} />
        </div>
      </Card>

      <Card className="settings-form">
        <div className="form-section">
          <h2>Historical Data Import</h2>
          <p className="text-muted">
            Import transaction history and category budgets from previous years&apos; Excel or CSV spreadsheets.
          </p>
          <HistoricalImporter />
        </div>
      </Card>

      <Card className="settings-form">
        <div className="form-section">
          <h2>Year-End Processing</h2>
          <p className="text-muted">
            Finalize your current year accounting and roll over balances to the next calendar year.
          </p>
          <YearManager currentYear={currentYear} />
        </div>
      </Card>
    </div>
  );
}
