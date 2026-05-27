import { describe, it, expect } from "vitest";
import { simulatePayoff, Debt } from "./debtUtils";

describe("simulatePayoff", () => {
  const sampleDebts: Debt[] = [
    { id: "a", name: "Credit Card A", balance: 1000, interestRate: 10, minimumPayment: 50 },
    { id: "b", name: "Personal Loan B", balance: 2000, interestRate: 20, minimumPayment: 100 }
  ];

  it("should handle empty debts list", () => {
    const result = simulatePayoff([], 100, "avalanche");
    expect(result.payoffMonths).toBe(0);
    expect(result.totalInterest).toBe(0);
    expect(result.schedule.length).toBe(1); // just month 0
  });

  it("should handle debts that are already fully paid off", () => {
    const paidDebts: Debt[] = [
      { id: "a", name: "Credit Card A", balance: 0, interestRate: 10, minimumPayment: 50 }
    ];
    const result = simulatePayoff(paidDebts, 100, "avalanche");
    expect(result.payoffMonths).toBe(0);
    expect(result.totalInterest).toBe(0);
  });

  it("should correctly simulate avalanche strategy (highest rate first)", () => {
    // Under avalanche, extra money goes to Debt B (20% APR) before Debt A (10% APR)
    const result = simulatePayoff(sampleDebts, 200, "avalanche");
    expect(result.payoffMonths).toBeLessThan(600);
    expect(result.strategyName).toBe("Debt Avalanche");

    // Let's verify that B is paid off or significantly reduced faster than A, excluding minimum payments
    // Look at first few months where extra is paid
    const month1 = result.schedule[1];
    expect(month1.payments["b"]).toBeGreaterThan(100); // Minimum 100 + extra
  });

  it("should correctly simulate snowball strategy (smallest balance first)", () => {
    // Under snowball, extra money goes to Debt A ($1000 balance) before Debt B ($2000 balance)
    const result = simulatePayoff(sampleDebts, 200, "snowball");
    expect(result.payoffMonths).toBeLessThan(600);
    expect(result.strategyName).toBe("Debt Snowball");

    const month1 = result.schedule[1];
    expect(month1.payments["a"]).toBeGreaterThan(50); // Minimum 50 + extra
  });

  it("should handle the debt trap (infinite loop / negative progress) gracefully", () => {
    // If interest is larger than payments, it should detect the trap and break
    // Debt balance $10,000, Interest Rate 50%, Minimum payment $10
    // Total monthly payment capability is $20. Monthly interest is ~$416.
    const badDebts: Debt[] = [
      { id: "trap", name: "Loan Shark", balance: 10000, interestRate: 50, minimumPayment: 10 }
    ];
    const result = simulatePayoff(badDebts, 10, "minimums");
    expect(result.payoffMonths).toBe(600); // reaches ceiling limit
  });
});
