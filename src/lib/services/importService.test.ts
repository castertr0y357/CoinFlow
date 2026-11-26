import { describe, it, expect } from "vitest";
import {
  detectHeaderRow,
  isInternalBudgetRow,
  isSkippedSheetName,
  parseExcelDate,
  parseCurrencyAmount,
} from "./importService";

describe("Historical Excel Import Parser", () => {
  it("detects header row on Row 3 with Location/Store column", () => {
    const rows = [
      ["Household", "", "", "", "", "", "", "", "", "Monthly Provision:", "", 1200],
      ["Section Total:", 77.57, "", "Back to total Page"],
      ["Date", "Description", "Location/Store", "Amount", "Balance"],
      ["2025-01-01", "Year Start", "", 0, 0],
      ["2025-01-04", "Potatoes and candy", "Lowes Foods", -8.87, 991.13],
    ];

    const detected = detectHeaderRow(rows);
    expect(detected).not.toBeNull();
    expect(detected?.headerRowIndex).toBe(2);
    expect(detected?.dateColumn).toBe("Date");
    expect(detected?.payeeColumn).toBe("Location/Store");
    expect(detected?.memoColumn).toBe("Description");
    expect(detected?.amountColumn).toBe("Amount");
    expect(detected?.headers).toEqual(["Date", "Description", "Location/Store", "Amount", "Balance"]);
  });

  it("detects header row without Location column and falls back to Description as payee", () => {
    const rows = [
      ["Utilities", "", "", "", "", "", "", "", "", "Monthly Provision:", "", 500],
      ["Section Total:", 222.47],
      ["Date", "Description", "Amount", "Balance"],
      ["2025-01-06", "Electric Bill", -175.26, 424.74],
    ];

    const detected = detectHeaderRow(rows);
    expect(detected).not.toBeNull();
    expect(detected?.headerRowIndex).toBe(2);
    expect(detected?.payeeColumn).toBe("Description");
    expect(detected?.memoColumn).toBe("");
    expect(detected?.amountColumn).toBe("Amount");
  });

  it("skips summary, income, debit, and charge ledger sheets by default", () => {
    expect(isSkippedSheetName("2025 Budget")).toBe(true);
    expect(isSkippedSheetName("Incomes")).toBe(true);
    expect(isSkippedSheetName("Debits")).toBe(true);
    expect(isSkippedSheetName("Charges")).toBe(true);
    expect(isSkippedSheetName("Household")).toBe(false);
    expect(isSkippedSheetName("Gas")).toBe(false);
    expect(isSkippedSheetName("Home Tech/Shooting")).toBe(false);
  });

  it("identifies internal budget rows (Year Start, Monthly Additions, Boost, Adjustment)", () => {
    expect(isInternalBudgetRow("Year Start")).toBe(true);
    expect(isInternalBudgetRow("January Addition")).toBe(true);
    expect(isInternalBudgetRow("December Addition")).toBe(true);
    expect(isInternalBudgetRow("Boost")).toBe(true);
    expect(isInternalBudgetRow("Adjustment")).toBe(true);
    expect(isInternalBudgetRow("Electric Bill")).toBe(false);
    expect(isInternalBudgetRow("Potatoes and candy")).toBe(false);
  });

  it("parses ISO dates, Excel serial dates, and currency amounts cleanly", () => {
    const iso = parseExcelDate("2025-01-04");
    expect(iso?.toISOString().slice(0, 10)).toBe("2025-01-04");

    // 45658 = 2025-01-01 in Excel serial date
    const serial = parseExcelDate(45658);
    expect(serial?.toISOString().slice(0, 10)).toBe("2025-01-01");

    expect(parseCurrencyAmount(-8.87)).toBe(-8.87);
    expect(parseCurrencyAmount("$1,234.56")).toBe(1234.56);
    expect(parseCurrencyAmount("(45.20)")).toBe(-45.2);
  });
});
