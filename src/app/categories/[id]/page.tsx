import prisma from "@/lib/prisma";
import Card from "@/components/ui/Card";
import CategoryDetailClient from "./CategoryDetailClient";
import { notFound } from "next/navigation";

export default async function CategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const currentYear = new Date().getFullYear();
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
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

  return (
    <div className="category-detail-page container animate-fade-in">
      <header className="page-header">
         <div className="breadcrumb">
            <a href="/">Dashboard</a> / Categories
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
          isPaused: category.isPaused
        }}
        transactions={category.splits.map(s => ({
          id: s.transaction.id,
          date: s.transaction.date,
          payee: s.transaction.payee,
          amount: Number(s.amount),
          memo: s.memo,
          accountId: s.transaction.accountId,
          accountName: s.transaction.account.name
        }))}
        otherCategories={otherCategories.map(c => ({ id: c.id, name: c.name }))}
        accounts={accounts.map(a => ({ id: a.id, name: a.name }))}
      />
    </div>
  );
}
