import prisma from "@/lib/prisma";
import Link from "next/link";
import Card from "@/components/ui/Card";
import SubscriptionDetective from "../SubscriptionDetective";
import HistoricalImporter from "../HistoricalImporter";

export default async function ToolsSettingsPage() {
  const currentYear = new Date().getFullYear();
  const allYears = await prisma.budgetYear.findMany({
    orderBy: { year: 'desc' }
  });

  const settings = await prisma.settings.findUnique({
    where: { id: 'global' }
  });
  const aiEnabled = settings?.aiEnabled ?? false;

  return (
    <div className="subpage-container animate-fade-in">
      {aiEnabled && (
        <Card className="settings-form">
          <div className="form-section">
            <h2>Subscription Detective</h2>
            <SubscriptionDetective />
          </div>
        </Card>
      )}

      {aiEnabled && (
        <Card className="settings-form">
          <div className="form-section">
            <h2>Historical XLSX Import</h2>
            <p className="text-muted">Ingest data from previous years. AI will help map your spreadsheet sheets to categories.</p>
            <HistoricalImporter />
          </div>
        </Card>
      )}

      <Card className="settings-form">
        <div className="form-section">
          <h2>Historical Archives</h2>
          <p className="text-muted">Quick access to finalized budgets from previous years.</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {allYears.filter(y => y.year < currentYear).map(y => (
              <Link 
                key={y.id} 
                href={`/history/${y.year}`}
                className="year-link glass p-3 rounded-lg border border-white/10 hover:border-primary transition-all"
              >
                📅 {y.year} Budget
              </Link>
            ))}
            {allYears.filter(y => y.year < currentYear).length === 0 && (
              <p className="text-sm italic opacity-50">No historical archives found yet.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
