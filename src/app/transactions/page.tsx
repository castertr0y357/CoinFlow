import prisma from "@/lib/prisma";
import TransactionsClient from "@/components/transactions/TransactionsClient";
import "./Transactions.css";

export default async function TransactionsPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  });

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
