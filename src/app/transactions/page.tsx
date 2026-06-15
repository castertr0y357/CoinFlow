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

      <TransactionsClient 
        categories={categories} 
        aiEnabled={settings?.aiEnabled ?? false} 
      />
    </div>
  );
}
