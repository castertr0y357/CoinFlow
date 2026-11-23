import { getWealthPageData } from "@/lib/services/planningService";
import WealthClient from "./WealthClient";

export const metadata = {
  title: "Wealth & FI Trajectory | CoinFlow",
};

export const dynamic = "force-dynamic";

export default async function WealthPage() {
  const data = await getWealthPageData();

  return (
    <div className="container animate-fade-in">
      <header className="page-header">
        <h1>Wealth &amp; FI Trajectory</h1>
        <p className="text-muted">
          Long-term investment growth projector seeded with your live 401(k)/IRA/brokerage balances and mortgage payoff milestone.
        </p>
      </header>
      <WealthClient initialData={data} />
    </div>
  );
}
