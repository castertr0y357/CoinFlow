import prisma from "@/lib/prisma";
import CategoryDetailClient from "./CategoryDetailClient";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const currentYear = new Date().getFullYear();
  const parsedYear = sp.year ? parseInt(sp.year, 10) : currentYear;
  const selectedYear = !isNaN(parsedYear) ? parsedYear : currentYear;
  const isHistorical = selectedYear < currentYear;

  const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
  const yearEnd = new Date(Date.UTC(selectedYear + 1, 0, 1));

  const [category, accounts, otherCategories, allYears] = await Promise.all([
    prisma.category.findUnique({
      where: { id },
      include: {
        commitments: true,
        configs: {
          where: { year: { year: selectedYear } },
        },
        splits: {
          where: {
            transaction: {
              date: { gte: yearStart, lt: yearEnd },
            },
          },
          include: {
            transaction: {
              include: { account: true },
            },
          },
          orderBy: {
            transaction: { date: "desc" },
          },
        },
      },
    }),
    prisma.account.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({
      where: { id: { not: id }, isArchived: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.budgetYear.findMany({
      orderBy: { year: "desc" },
      select: { year: true },
    }),
  ]);

  if (!category) notFound();

  const availableYears = Array.from(
    new Set([currentYear, selectedYear, ...allYears.map((y) => y.year)])
  ).sort((a, b) => b - a);

  const rollover = Number(category.configs[0]?.rollover || 0);
  const spent = category.splits.reduce((acc, s) => acc + Number(s.amount), 0);
  const remaining = rollover + spent;

  const commitments = category.commitments || [];
  const commitmentsMonthly = commitments.reduce((acc, comm) => {
    let monthly = Number(comm.amount);
    if (comm.frequency === "YEARLY") monthly = monthly / 12;
    else if (comm.frequency === "SEMI_ANNUAL") monthly = monthly / 6;
    else if (comm.frequency === "QUARTERLY") monthly = monthly / 3;
    return acc + monthly;
  }, 0);

  return (
    <div className="category-detail-page container animate-fade-in">
      <header className="page-header">
        <div className="breadcrumb">
          {isHistorical ? (
            <>
              <Link href={`/history/${selectedYear}`}>{selectedYear} Archive</Link> / Categories
            </>
          ) : (
            <>
              <Link href="/">Dashboard</Link> / Categories
            </>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1>{category.name}</h1>
            <p className="text-muted">
              Showing {selectedYear} ledger ({category.splits.length} entries).
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            {availableYears.map((y) => (
              <Link
                key={y}
                href={`/categories/${id}?year=${y}`}
                style={{
                  padding: "0.3rem 0.65rem",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  color: y === selectedYear ? "#fff" : "var(--text-muted)",
                  background: y === selectedYear ? "rgba(99, 102, 241, 0.25)" : "rgba(255, 255, 255, 0.04)",
                  border: y === selectedYear ? "1px solid rgba(99, 102, 241, 0.5)" : "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <CategoryDetailClient
        category={{
          id: category.id,
          name: category.name,
          budget: Number(category.configs[0]?.monthlyBudget || 0),
          rollover,
          spent,
          remaining,
          tiedAccountId: category.tiedAccountId,
          isPaused: category.isPaused,
          commitments: commitments.map((c) => ({
            id: c.id,
            name: c.name,
            amount: Number(c.amount),
            frequency: c.frequency,
            type: c.type,
          })),
          commitmentsMonthly,
        }}
        transactions={category.splits.map((s) => ({
          id: s.transaction.id,
          date: s.transaction.date,
          payee: s.transaction.payee,
          amount: Number(s.amount),
          memo: s.memo,
          accountId: s.transaction.accountId,
          accountName: s.transaction.account.displayName || s.transaction.account.name,
        }))}
        otherCategories={otherCategories}
        accounts={accounts.map((a) => ({ id: a.id, name: a.displayName || a.name }))}
      />
    </div>
  );
}
