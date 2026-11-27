import prisma from "@/lib/prisma";
import Link from "next/link";
import Card from "@/components/ui/Card";
import CategoryManager from "../CategoryManager";
import YearManager from "../YearManager";

export default async function CategoriesSettingsPage() {
  const currentYear = new Date().getFullYear();

  const [categories, allYears] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, isArchived: true },
    }),
    prisma.budgetYear.findMany({
      orderBy: { year: "desc" },
    }),
  ]);

  const pastYears = allYears.filter((y) => y.year < currentYear);

  return (
    <div className="subpage-container animate-fade-in">
      <Card className="settings-form">
        <div className="form-section">
          <h2>Category Management</h2>
          <p className="text-muted">
            Add or remove budget categories. Categories with existing transactions cannot be deleted.
          </p>
          <CategoryManager initialCategories={categories} />
        </div>
      </Card>

      <div className="settings-bento-2">
        <Card className="settings-form">
          <div className="form-section">
            <h2>Year-End Processing</h2>
            <p className="text-muted">
              Finalize your current year accounting and roll over balances to the next calendar year.
            </p>
            <YearManager currentYear={currentYear} />
          </div>
        </Card>

        <Card className="settings-form">
          <div className="form-section">
            <h2>Historical Archives</h2>
            <p className="text-muted">Quick access to finalized budgets from previous years.</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {pastYears.map((y) => (
                <Link
                  key={y.id}
                  href={`/history/${y.year}`}
                  className="year-link glass p-3 rounded-lg border border-white/10 hover:border-primary transition-all"
                >
                  📅 {y.year} Budget
                </Link>
              ))}
              {pastYears.length === 0 && (
                <p className="text-sm italic opacity-50">No historical archives found yet.</p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
