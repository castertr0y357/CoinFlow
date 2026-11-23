import { getCashFlowPageData } from "@/lib/services/planningService";
import CashFlowClient from "./CashFlowClient";

export const metadata = {
  title: "Cash Flow Timeline | CoinFlow",
};

export const dynamic = "force-dynamic";

export default async function CashFlowPage() {
  const data = await getCashFlowPageData();

  return (
    <div className="container animate-fade-in">
      <header className="page-header">
        <h1>Cash Flow Timeline</h1>
        <p className="text-muted">
          Forward-looking checking balance projection using your live cash, paycheck schedule, commitments, and card balances.
        </p>
      </header>
      <CashFlowClient initialData={data} />
    </div>
  );
}
