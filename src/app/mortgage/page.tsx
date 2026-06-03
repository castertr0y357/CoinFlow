import prisma from "@/lib/prisma";
import MortgageClient from "./MortgageClient";

export const metadata = {
  title: "Mortgage Mastery | CoinFlow",
};

export default async function MortgagePage() {
  const mortgages = await prisma.mortgageDetail.findMany({
    include: { 
      account: true,
      providers: true
    },
    orderBy: {
      account: {
        name: 'asc'
      }
    }
  });

  const accounts = await prisma.account.findMany({
    orderBy: { name: 'asc' }
  });

  const mortgagesData = mortgages.map(mortgage => ({
    ...mortgage,
    currentBalance: Math.abs(Number(mortgage.account.balance || 0)),
    interestRate: Number(mortgage.interestRate),
    monthlyPayment: Number(mortgage.monthlyPayment),
    homeValue: mortgage.homeValue ? Number(mortgage.homeValue) : null,
    manualHomeValue: mortgage.manualHomeValue ? Number(mortgage.manualHomeValue) : null,
    originalBalance: mortgage.originalBalance ? Number(mortgage.originalBalance) : null,
    address: mortgage.address || "",
    providers: mortgage.providers.map(p => ({
      ...p,
      lastValue: p.lastValue ? Number(p.lastValue) : null,
      lastSync: p.lastSync ? p.lastSync.toISOString() : null,
    })),
  }));

  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const hasRentcastApiKey = !!(settings?.rentcastApiKey || process.env.RENTCAST_API_KEY);

  return (
    <div className="mortgage-page container animate-fade-in">
      <MortgageClient 
        initialMortgages={mortgagesData} 
        accounts={accounts.map(a => ({ id: a.id, name: a.name }))} 
        hasRentcastApiKey={hasRentcastApiKey}
      />
    </div>
  );
}
