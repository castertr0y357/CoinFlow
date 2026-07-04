import { Suspense } from "react";
import prisma from "@/lib/prisma";
import { getMonthlyTally } from "@/lib/services/budgetService";
import TransactionsClient from "@/components/transactions/TransactionsClient";
import "./Transactions.css";

export default async function TransactionsPage() {
  const tally = await getMonthlyTally();
  const categories = tally.categories
    .map(c => ({
      id: c.id,
      name: c.name,
      balance: c.remaining
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const accounts = await prisma.account.findMany({
    orderBy: { name: 'asc' }
  });

  const mappedAccounts = accounts.map(a => ({
    id: a.id,
    name: a.name,
    displayName: a.displayName
  }));

  const settings = await prisma.settings.findUnique({
    where: { id: "global" }
  });

  return (
    <div className="transactions-container">
      <header className="page-header">
        <h1 className="animate-fade-in">Transactions Inbox</h1>
        <p className="text-dim animate-fade-in" style={{ animationDelay: '0.1s' }}>
          Categorize your spending or leave items floating.
        </p>
      </header>

      <Suspense fallback={<div className="transactions-list glass skeleton animate-fade-in" style={{ minHeight: '400px' }}></div>}>
        <TransactionsClient 
          categories={categories} 
          accounts={mappedAccounts}
          aiEnabled={settings?.aiEnabled ?? false} 
        />
      </Suspense>
    </div>
  );
}

