import prisma from "@/lib/prisma";
import Card from "@/components/ui/Card";
import ReportsClient from "./ReportsClient";

export const metadata = {
  title: "Yearly Analysis | WebBudget",
};

export default async function ReportsPage() {
  const years = await prisma.transaction.findMany({
    select: { date: true },
    distinct: ['date'],
    orderBy: { date: 'desc' }
  });

  const availableYears = Array.from(new Set(years.map(y => y.date.getFullYear())));
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear, 11, 31);

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
            },
            account: {
              excludeFromSurplus: false
            }
          }
        },
        include: { transaction: true }
      }
    }
  });

  return (
    <div className="reports-page container animate-fade-in">
      <header className="page-header">
        <h1>Financial Insights</h1>
        <p className="text-muted">Analyze trends and optimize your long-term strategy.</p>
      </header>

      <ReportsClient 
        availableYears={availableYears}
        initialCategories={categories.map(c => {
          const config = c.configs[0];
          return {
            id: c.id,
            name: c.name,
            budget: Number(config?.monthlyBudget || 0) * 12,
            adjustment: Number(config?.adjustment || 0),
            rollover: Number(config?.rollover || 0),
            totalSpent: c.splits.reduce((acc, s) => acc + (Number(s.amount) * -1), 0)
          };
        })}
      />
    </div>
  );
}
