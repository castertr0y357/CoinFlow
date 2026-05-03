import prisma from "@/lib/prisma";
import CommitmentsClient from "./CommitmentsClient";

export const metadata = {
  title: "Commitments & Fixed Costs | WebBudget",
};

export default async function CommitmentsPage() {
  const commitments = await prisma.commitment.findMany({
    include: { category: true },
    orderBy: { name: 'asc' }
  });

  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <div className="commitments-page container animate-fade-in">
      <header className="page-header">
        <h1>Commitments & Fixed Costs</h1>
        <p className="text-muted">Manage your recurring obligations and sync them with your budget.</p>
      </header>
      
      <CommitmentsClient 
        initialCommitments={commitments.map(c => ({
          ...c,
          amount: Number(c.amount)
        }))} 
        categories={categories} 
      />
    </div>
  );
}
