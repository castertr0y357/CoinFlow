import { describe, it, expect } from "vitest";
import { buildCashFlowTimeline, buildWealthProjection } from "./planningService";

describe("planningService", () => {
  it("buildCashFlowTimeline computes lowest balance, safeToSweep, and scheduled events", () => {
    const start = new Date(2026, 10, 1); // Nov 1, 2026
    const result = buildCashFlowTimeline({
      startDate: start,
      horizonDays: 30,
      startingCash: 5000,
      safetyBuffer: 1000,
      includeCreditCards: true,
      creditCardBalance: 1200,
      cardAutopayDay: 15,
      paycheckEnabled: true,
      paycheckAmount: 2500,
      paycheckFrequency: "BI_WEEKLY",
      paycheckNextDate: new Date(2026, 10, 6),
      monthlyIncome: 5000,
      commitments: [
        {
          id: "c1",
          name: "Mortgage",
          amount: 2000,
          frequency: "MONTHLY",
          nextDueDate: new Date(2026, 10, 10),
        },
      ],
    });

    expect(result.startingCash).toBe(5000);
    expect(result.events.length).toBeGreaterThanOrEqual(4);
    expect(result.lowestBalance).toBeLessThanOrEqual(5000);
    expect(result.safeToSweep).toBe(Math.max(0, result.lowestBalance - 1000));
  });

  it("buildWealthProjection models post-mortgage payment redirection boost", () => {
    const result = buildWealthProjection({
      currentInvestments: 100000,
      currentCash: 20000,
      monthlyContribution: 1000,
      annualReturnPct: 7,
      years: 15,
      fiTarget: 500000,
      mortgage: {
        balance: 60000,
        interestRate: 4.0,
        monthlyPayment: 1200,
      },
      redirectMortgageAfterPayoff: true,
      startYear: 2026,
    });

    expect(result.mortgagePayoffYear).toBeGreaterThan(2026);
    expect(result.mortgageBoost).toBeGreaterThan(0);
    expect(result.finalAccelerated).toBeGreaterThan(result.finalBaseline);
    expect(result.fiTargetYearAccelerated).not.toBeNull();
  });
});
