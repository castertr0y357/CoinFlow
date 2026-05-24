import prisma from "@/lib/prisma";
import AccountsClient from "./AccountsClient";
import "./Accounts.css";

export const metadata = {
  title: "Accounts Configuration | CoinFlow",
};

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await prisma.account.findMany({
    orderBy: { name: 'asc' }
  });

  const mappedAccounts = accounts.map(a => ({
    id: a.id,
    name: a.name,
    displayName: a.displayName,
    balance: Number(a.balance || 0),
    type: a.type || 'Other',
    excludeFromSurplus: a.excludeFromSurplus,
    isDebt: a.isDebt,
    showInSidebar: a.showInSidebar,
    excludeFromAssetCalculation: a.excludeFromAssetCalculation,
    showTransactions: a.showTransactions
  }));

  return (
    <div className="accounts-page container animate-fade-in">
      <header className="page-header">
        <h1>Accounts Configuration</h1>
        <p className="text-muted">Customize sidebar visibility, net worth inclusion, surplus status, and rename accounts.</p>
      </header>

      <AccountsClient initialAccounts={mappedAccounts} />
    </div>
  );
}
