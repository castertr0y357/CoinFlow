import { getNetWorthData } from "@/lib/services/netWorthService";
import NetWorthClient from "./NetWorthClient";
import "./NetWorth.css";

export const metadata = {
  title: "Net Worth Tracker | CoinFlow",
};

export const dynamic = "force-dynamic";

export default async function NetWorthPage() {
  const data = await getNetWorthData();

  return (
    <div className="net-worth-page container animate-fade-in">
      <header className="page-header">
        <h1>Net Worth & Wealth</h1>
        <p className="text-muted">Track your long-term wealth accumulation and overall net worth.</p>
      </header>

      <NetWorthClient initialData={data} />
    </div>
  );
}
