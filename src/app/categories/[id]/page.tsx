import prisma from "@/lib/prisma";
import CategoryDetailClient from "./CategoryDetailClient";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentYear = new Date().getFullYear();
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      commitments: true,
      configs: {
        where: { year: { year: currentYear } }
      },
      splits: {
        include: {
          transaction: {
            include: { account: true }
          }
        },
        orderBy: {
          transaction: { date: 'desc' }
        }
      }
    }
  });

  if (!category) notFound();
  const accounts = await prisma.account.findMany({ orderBy: { name: 'asc' } });

  const otherCategories = await prisma.category.findMany({
    where: { id: { not: category.id } },
    orderBy: { name: 'asc' }
  });

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
            <Link href="/">Dashboard</Link> / Categories
         </div>
         <h1>{category.name}</h1>
         <p className="text-muted">Manage allocations and re-classify transactions.</p>
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
          commitments: commitments.map(c => ({
            id: c.id,
            name: c.name,
            amount: Number(c.amount),
            frequency: c.frequency,
            type: c.type
          })),
          commitmentsMonthly
        }}
        transactions={category.splits.map(s => ({
          id: s.transaction.id,
          date: s.transaction.date,
          payee: s.transaction.payee,
          amount: Number(s.amount),
          memo: s.memo,
          accountId: s.transaction.accountId,
          accountName: s.transaction.account.displayName || s.transaction.account.name
        }))}
        otherCategories={otherCategories.map(c => ({ id: c.id, name: c.name }))}
        accounts={accounts.map(a => ({ id: a.id, name: a.displayName || a.name }))}
      />
    </div>
  );
}
