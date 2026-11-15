import prisma from "@/lib/prisma";
import ReportsClient from "./ReportsClient";

export const metadata = {
  title: "Yearly Analysis | CoinFlow",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const [budgetYears, dateRange] = await Promise.all([
    prisma.budgetYear.findMany({ orderBy: { year: 'desc' }, select: { year: true } }),
    prisma.transaction.aggregate({ _min: { date: true }, _max: { date: true } }),
  ]);

  const yearSet = new Set(budgetYears.map(y => y.year));
  if (dateRange._min.date && dateRange._max.date) {
    const minY = dateRange._min.date.getFullYear();
    const maxY = dateRange._max.date.getFullYear();
    for (let y = minY; y <= maxY; y++) yearSet.add(y);
  }
  const availableYears = Array.from(yearSet).sort((a, b) => b - a);
  const parsedYear = params.year ? parseInt(params.year, 10) : NaN;
  const currentYear = !isNaN(parsedYear) ? parsedYear : new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);

  const categories = await prisma.category.findMany({
    include: {
      configs: {
        where: { year: { year: currentYear } }
      },
      splits: {
        where: {
          transaction: {
            date: {
              gte: yearStart,
              lte: yearEnd
            }
          }
        },
        include: { transaction: true }
      }
    }
  });

  const settings = await prisma.settings.findUnique({
    where: { id: "global" }
  });

  return (
    <div className="reports-page container animate-fade-in">
      <header className="page-header">
        <h1>Financial Insights</h1>
        <p className="text-muted">Analyze trends and optimize your long-term strategy.</p>
      </header>

      <ReportsClient 
        availableYears={availableYears}
        selectedYear={currentYear}
        initialCategories={categories.map(c => {
          const config = c.configs[0];
          const rollover = Number(config?.rollover || 0);
          const adjustment = Number(config?.adjustment || 0);
          const totalSpent = c.splits
            .filter(s => Number(s.amount) < 0)
            .reduce((acc, s) => acc + (Number(s.amount) * -1), 0);
          const netSplits = c.splits.reduce((acc, s) => acc + Number(s.amount), 0);
          const currentBalance = rollover + adjustment + netSplits;

          return {
            id: c.id,
            name: c.name,
            budget: Number(config?.monthlyBudget || 0) * 12,
            adjustment,
            rollover,
            totalSpent,
            currentBalance
          };
        })}
        aiEnabled={settings?.aiEnabled ?? false}
      />
    </div>
  );
}
