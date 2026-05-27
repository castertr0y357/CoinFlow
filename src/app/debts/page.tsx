import prisma from "@/lib/prisma";
import { getDebtAccounts } from "@/lib/services/debtService";
import DebtsClient from "./DebtsClient";
import "./Debts.css";

export const metadata = {
  title: "Debt Payoff Command Center | CoinFlow",
};

export default async function DebtsPage() {
  const debtAccounts = await getDebtAccounts();

  // Fetch liquid asset accounts to calculate available checking/savings buffer
  const assetAccountsRaw = await prisma.account.findMany({
    where: {
      isDebt: false
    },
    orderBy: { name: 'asc' }
  });

  const assetAccounts = assetAccountsRaw.map(acc => ({
    id: acc.id,
    name: acc.displayName || acc.name,
    balance: Number(acc.balance || 0),
    type: acc.type || 'CASH',
    excludeFromSurplus: acc.excludeFromSurplus
  }));

  return (
    <div className="debts-page container animate-fade-in">
      <DebtsClient 
        initialDebts={debtAccounts} 
        liquidAssets={assetAccounts}
      />
    </div>
  );
}
