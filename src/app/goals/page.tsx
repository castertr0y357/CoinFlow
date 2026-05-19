import prisma from "@/lib/prisma";
import { getGoals } from "@/lib/services/goalService";
import GoalsClient from "./GoalsClient";

export const metadata = {
  title: "Savings & Big Purchases Tracker | CoinFlow",
};

export const dynamic = "force-dynamic";

export default async function GoalsPage() {
  const goals = await getGoals();
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="goals-page container animate-fade-in">
      <header className="page-header">
        <h1>Savings & Big Purchases Tracker</h1>
        <p className="text-muted">Set timelines, budgets, and track progress for your large purchases, trips, and projects.</p>
      </header>
      
      <GoalsClient 
        initialGoals={goals} 
        categories={categories.map(c => ({ id: c.id, name: c.name }))} 
      />
    </div>
  );
}
