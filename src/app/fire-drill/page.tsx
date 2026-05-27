import { getMonthlyTally } from "@/lib/services/budgetService";
import FireDrillClient from "./FireDrillClient";
import "./FireDrill.css";

export const metadata = {
  title: "Financial Fire Drill | CoinFlow",
};

export default async function FireDrillPage() {
  const tally = await getMonthlyTally();
  const categories = tally.categories.filter(c => !c.isOffBudget);

  return (
    <div className="fire-drill-page container animate-fade-in">
      <FireDrillClient 
        categories={categories}
        accounts={tally.accounts.filter(a => !a.isDebt)}
        initialForecast={tally.forecast}
      />
    </div>
  );
}
