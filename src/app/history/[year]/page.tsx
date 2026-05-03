import prisma from "@/lib/prisma";
import DashboardClient from "@/components/dashboard/DashboardClient";
import Link from "next/link";
import "../../Dashboard.css";

export default async function HistoryPage({ params }: { params: Promise<{ year: string }> }) {
  const { year: yearStr } = await params;
  const year = parseInt(yearStr);
  
  if (isNaN(year)) {
    return <div>Invalid year</div>;
  }

  // Check if this year actually exists in our budget records
  const budgetYear = await prisma.budgetYear.findUnique({
    where: { year }
  });

  if (!budgetYear) {
    return (
      <div className="container p-12 text-center">
        <h1 className="text-4xl mb-4">Year Not Found</h1>
        <p className="text-muted mb-8">We don't have any budget records for the year {year}.</p>
        <Link href="/settings" className="btn btn-primary">Go to Importer</Link>
      </div>
    );
  }

  return (
    <div className="history-page container animate-fade-in">
      <header className="page-header flex justify-between items-center mb-8">
        <div>
           <Link href="/settings" className="text-sm text-primary hover:underline mb-2 block">← Back to Settings</Link>
           <h1 className="text-4xl font-bold">Historical Budget: {year}</h1>
           <p className="text-muted">Viewing finalized data for the calendar year {year}.</p>
        </div>
        <div className="year-badge glass p-4 text-2xl font-mono text-primary">
          ARCHIVE
        </div>
      </header>

      <DashboardClient year={year} />
    </div>
  );
}
