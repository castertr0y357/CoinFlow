import { describe, it, expect } from "vitest";
import {
  cleanMerchantNameDeterministic,
  cleanRetailItemTitleDeterministic,
  detectSubscriptionsDeterministic,
  buildPayeeCategoryMemory,
  suggestItemCategoryDeterministic,
  isMultiCategoryRetailer,
  lookupPayeeCategory,
} from "./normalizer";

describe("cleanMerchantNameDeterministic", () => {
  it("uses historical rawPayee mapping when available", () => {
    const history = new Map<string, string>([
      ["SQ *BLUE BOTTLE 04", "Blue Bottle Coffee"],
    ]);
    expect(cleanMerchantNameDeterministic("SQ *BLUE BOTTLE 04", history)).toBe("Blue Bottle Coffee");
  });

  it("normalizes canonical merchants deterministically", () => {
    expect(cleanMerchantNameDeterministic("AMZN Mktp US*1A2B3C")).toBe("Amazon");
    expect(cleanMerchantNameDeterministic("WAL-MART #3219")).toBe("Walmart");
    expect(cleanMerchantNameDeterministic("LOWE'S #0412")).toBe("Lowe's");
    expect(cleanMerchantNameDeterministic("NETFLIX.COM")).toBe("Netflix");
  });

  it("strips POS prefixes, store numbers, and state codes and title-cases", () => {
    expect(cleanMerchantNameDeterministic("TST* CORNER BAKERY #412 IL")).toBe("Corner Bakery");
    expect(cleanMerchantNameDeterministic("SQ *LOCAL ROASTERS*9988")).toBe("Local Roasters");
  });
});

describe("cleanRetailItemTitleDeterministic", () => {
  it("strips bracketed tags, SEO pipe/comma fluff, and caps length", () => {
    const raw = "[2-Pack] Anker USB-C Charger, Fast Charging Block for iPhone 16 Pro Max | Black";
    const cleaned = cleanRetailItemTitleDeterministic(raw);
    expect(cleaned).toBe("Anker USB-C Charger");
  });

  it("truncates long titles cleanly at word boundaries", () => {
    const raw = "Stainless Steel Insulated Water Bottle With Straw Lid For Sports Hiking Gym Travel";
    const cleaned = cleanRetailItemTitleDeterministic(raw, 45);
    expect(cleaned.length).toBeLessThanOrEqual(45);
    expect(cleaned).not.toMatch(/\s$/);
  });
});

describe("detectSubscriptionsDeterministic", () => {
  it("detects monthly recurring outflow charges accurately", () => {
    const txs = [
      { date: "2026-08-15", payee: "NETFLIX.COM", amount: -15.49 },
      { date: "2026-09-15", payee: "NETFLIX.COM", amount: -15.49 },
      { date: "2026-10-15", payee: "NETFLIX.COM", amount: -15.49 },
      // One-off purchase should not be detected
      { date: "2026-10-10", payee: "HOME DEPOT #123", amount: -84.20 },
      // Positive inflow should be ignored
      { date: "2026-09-01", payee: "PAYROLL", amount: 2500 },
      { date: "2026-10-01", payee: "PAYROLL", amount: 2500 },
    ];

    const subs = detectSubscriptionsDeterministic(txs);
    expect(subs).toHaveLength(1);
    expect(subs[0].name).toBe("Netflix");
    expect(subs[0].monthlyCost).toBe(15.49);
    expect(subs[0].confidence).toBeGreaterThanOrEqual(0.85);
    expect(subs[0].reason).toContain("monthly");
  });

  it("builds payee-to-category memory from commitments and consistent history while excluding multi-category retailers", () => {
    const memory = buildPayeeCategoryMemory({
      commitments: [
        { name: "Netflix", categoryId: "cat-ent" },
        { name: "Amazon", categoryId: "cat-shop" },
      ],
      historicalSplits: [
        { payee: "ALDI #45", categoryId: "cat-groc" },
        { payee: "Aldi", categoryId: "cat-groc" },
        { payee: "Amazon.com", categoryId: "cat-shop" },
        { payee: "Amazon.com", categoryId: "cat-shop" },
        { payee: "OneOffShop", categoryId: "cat-misc" },
      ],
    });

    expect(memory.get("netflix")).toBe("cat-ent");
    expect(memory.get("aldi")).toBe("cat-groc");
    expect(memory.has("amazon")).toBe(false);
    expect(memory.has("amazon.com")).toBe(false);
    expect(memory.has("oneoffshop")).toBe(false);
  });

  it("deterministically suggests retail item categories from past memos and keyword groups", () => {
    const categories = [
      { id: "1", name: "Groceries" },
      { id: "2", name: "Household Supplies" },
      { id: "3", name: "Pets" },
    ];
    const pastMemos = [
      { memo: "Kirkland Signature Organic Coffee Beans", categoryName: "Groceries" },
    ];

    expect(
      suggestItemCategoryDeterministic("Kirkland Signature Organic Coffee Beans 2lb", categories, pastMemos)
    ).toBe("Groceries");

    expect(
      suggestItemCategoryDeterministic("Bounty Paper Towels 12-Pack", categories, pastMemos)
    ).toBe("Household Supplies");

    expect(
      suggestItemCategoryDeterministic("Purina Dog Kibble 30lb Bag", categories, pastMemos)
    ).toBe("Pets");
  });

  it("matches Lowe's Foods, TST* prefixed payees, and compact/prefix merchant names", () => {
    expect(isMultiCategoryRetailer("Lowe's Foods")).toBe(false);
    expect(isMultiCategoryRetailer("LOWE'S FOODS #236")).toBe(false);
    expect(isMultiCategoryRetailer("Lowe's")).toBe(true);

    const memory = buildPayeeCategoryMemory({
      commitments: [],
      historicalSplits: [
        { payee: "Lowe's Foods", categoryId: "cat-house" },
        { payee: "Lowe's Foods", categoryId: "cat-house" },
        { payee: "TST*THE HABIT COFFEE C", categoryId: "cat-fun" },
        { payee: "TST*THE HABIT COFFEE C", categoryId: "cat-fun" },
        { payee: "REPUBLIC SERVICES TRAS", categoryId: "cat-util" },
        { payee: "REPUBLIC SERVICES TRAS", categoryId: "cat-util" },
      ],
    });

    expect(lookupPayeeCategory("LOWE'S FOODS #236", memory)).toBe("cat-house");
    expect(lookupPayeeCategory("TST*THE HABIT COFFEE C", memory)).toBe("cat-fun");
    expect(lookupPayeeCategory("Republicservices", memory)).toBe("cat-util");
  });
});
