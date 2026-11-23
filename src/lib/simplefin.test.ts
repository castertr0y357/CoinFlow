import { describe, it, expect } from "vitest";
import { matchSimpleFinAccountError, SimpleFinErrorItem } from "./simplefin";

describe("matchSimpleFinAccountError", () => {
  it("matches SimpleFIN v2 errlist items by conn_id", () => {
    const errlist: SimpleFinErrorItem[] = [
      {
        code: "con.auth",
        msg: "Connection to Truist may need attention.",
        conn_id: "MBR-truist",
      },
      {
        code: "con.auth",
        msg: "Connection to E*Trade may need attention.",
        conn_id: "MBR-etrade",
      },
    ];

    const truistAcc = {
      id: "ACT-1",
      name: "Checking 9719",
      balance: "100.00",
      currency: "USD",
      conn_id: "MX-MBR-truist",
      transactions: [],
    };

    const healthyAcc = {
      id: "ACT-2",
      name: "Fidelity 401k",
      balance: "500.00",
      currency: "USD",
      conn_id: "MBR-fidelity",
      "balance-date": Math.floor(Date.now() / 1000) - 10 * 86400, // 10 days old
      transactions: [],
    };

    expect(matchSimpleFinAccountError(truistAcc, [], errlist)).toBe(
      "Connection to Truist may need attention."
    );
    expect(matchSimpleFinAccountError(healthyAcc, [], errlist)).toBeNull();
  });

  it("falls back to SimpleFIN v1 errors[] string matching via org name", () => {
    const acc = {
      id: "ACT-3",
      name: "Mortgage 5574",
      balance: "-200000.00",
      currency: "USD",
      org: { name: "PennyMac Loan Services", domain: "www.pennymac.com" },
      transactions: [],
    };

    expect(
      matchSimpleFinAccountError(acc, [
        "Connection to PennyMac Loan Services may need attention.",
      ])
    ).toBe("Connection to PennyMac Loan Services may need attention.");
  });

  it("falls back to stale balance-date when unattributed errors exist", () => {
    const staleAcc = {
      id: "ACT-4",
      name: "Old Savings",
      balance: "100.00",
      currency: "USD",
      "balance-date": Math.floor(Date.now() / 1000) - 5 * 86400,
      transactions: [],
    };

    expect(
      matchSimpleFinAccountError(staleAcc, ["Generic connection error"])
    ).toBe("Generic connection error");
  });
});
