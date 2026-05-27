import { describe, it, expect } from "vitest";
import { calculateAmortization } from "./mortgageService";

describe("calculateAmortization", () => {
  it("should return empty schedule if balance is 0", () => {
    const result = calculateAmortization(0, 5.0, 1000);
    expect(result.length).toBe(0);
  });

  it("should compute standard amortization schedule correctly", () => {
    const balance = 100000;
    const rate = 6.0;
    const monthlyPayment = 1000;

    const result = calculateAmortization(balance, rate, monthlyPayment);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(600);

    // Verify last month pays off the loan
    const lastRow = result[result.length - 1];
    expect(lastRow.balance).toBe(0);
    expect(lastRow.totalInterest).toBeGreaterThan(0);
  });

  it("should accelerate payoff when extra monthly principal is paid", () => {
    const balance = 100000;
    const rate = 6.0;
    const monthlyPayment = 800;

    const standard = calculateAmortization(balance, rate, monthlyPayment, 0);
    const accelerated = calculateAmortization(balance, rate, monthlyPayment, 100);

    expect(accelerated.length).toBeLessThan(standard.length);
    expect(accelerated[accelerated.length - 1].totalInterest).toBeLessThan(
      standard[standard.length - 1].totalInterest
    );
  });

  it("should apply annual extra payments in month 12, 24, etc.", () => {
    const balance = 100000;
    const rate = 6.0;
    const monthlyPayment = 800;

    const result = calculateAmortization(balance, rate, monthlyPayment, 0, 1000);
    
    // Month 12 should have extra paid
    const month12 = result.find(row => row.month === 12);
    expect(month12).toBeDefined();
    expect(month12!.extraPaid).toBe(1000);

    // Month 1 should NOT have annual extra paid
    const month1 = result.find(row => row.month === 1);
    expect(month1).toBeDefined();
    expect(month1!.extraPaid).toBe(0);
  });

  it("should apply one-time extra payments on specific months", () => {
    const balance = 100000;
    const rate = 6.0;
    const monthlyPayment = 800;
    const oneTimeExtras = [{ monthIndex: 5, amount: 5000 }];

    const result = calculateAmortization(balance, rate, monthlyPayment, 0, 0, oneTimeExtras);
    const month5 = result.find(row => row.month === 5);
    expect(month5).toBeDefined();
    expect(month5!.extraPaid).toBe(5000);
  });

  it("should terminate at 600 months even if loan is not paid off (prevention of infinite loops)", () => {
    // Payment of $100 is less than interest on $1,000,000 at 6% ($5000/month)
    const result = calculateAmortization(1000000, 6.0, 100);
    expect(result.length).toBe(600);
    expect(result[result.length - 1].balance).toBe(1000000);
  });
});
