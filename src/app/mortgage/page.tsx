import prisma from "@/lib/prisma";
import { getMortgageData } from "@/lib/services/mortgageService";
import MortgageClient from "./MortgageClient";

export const metadata = {
  title: "Mortgage Mastery | WebBudget",
};

export default async function MortgagePage() {
  const mortgage = await prisma.mortgageDetail.findFirst({
    include: { 
      account: true,
      providers: true
    }
  });

  const accounts = await prisma.account.findMany({
    orderBy: { name: 'asc' }
  });

  const mortgageData = mortgage ? {
    ...mortgage,
    currentBalance: Math.abs(Number(mortgage.account.balance || 0)),
    interestRate: Number(mortgage.interestRate),
    monthlyPayment: Number(mortgage.monthlyPayment),
    homeValue: mortgage.homeValue ? Number(mortgage.homeValue) : null,
  } : null;

  return (
    <div className="mortgage-page container animate-fade-in">
      <header className="page-header">
        <h1>Mortgage Mastery</h1>
        <p className="text-muted">Track equity and optimize your payoff strategy.</p>
      </header>
      
      <MortgageClient 
        initialData={mortgageData} 
        accounts={accounts.map(a => ({ id: a.id, name: a.name }))} 
      />
    </div>
  );
}
