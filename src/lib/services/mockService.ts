/**
 * Mock Service
 * Provides mock API payloads for SimpleFIN, RentCast, and AI completion services
 * to enable offline development and test sandboxing when MOCK_MODE=true is set in .env.
 */

export function isMockMode(): boolean {
  return process.env.MOCK_MODE === "true";
}

// 1. SimpleFIN Mock payloads
export interface MockSimpleFinResult {
  accountCount: number;
  transactionCount: number;
}

export function getMockSimpleFinSync(): MockSimpleFinResult {
  return {
    accountCount: 3,
    transactionCount: 12
  };
}

// 2. RentCast AVM Valuation Mock payloads
export interface MockRentCastAvm {
  price: number;
  address: string;
  confidenceScore: number;
}

export function getMockRentCastValue(address: string): MockRentCastAvm {
  return {
    price: 450000,
    address: address || "123 Main St, Anytown, USA",
    confidenceScore: 0.92
  };
}

export function getMockRentCastTaxValue(address: string): { totalValue: number } {
  return {
    totalValue: 310000
  };
}

// 3. AI Assistant Completion Mock payloads
export function getMockAiCategorize(transactionIds: string[], categories: { id: string; name: string }[]): Record<string, string> {
  const suggestions: Record<string, string> = {};
  
  // Assign random categories from the database categories to the transactionIds
  if (categories.length > 0) {
    transactionIds.forEach((id, index) => {
      const cat = categories[index % categories.length];
      suggestions[id] = cat.id;
    });
  }
  
  return suggestions;
}

export function getMockAiSplits(txAmount: number, categories: { id: string; name: string }[]) {
  const amount = Math.abs(txAmount);
  if (categories.length < 2) return [];

  const part1 = Number((amount * 0.4).toFixed(2));
  const part2 = Number((amount - part1).toFixed(2));

  return [
    {
      categoryId: categories[0].id,
      amount: txAmount < 0 ? -part1 : part1,
      memo: "Mock Split 1 (Groceries)"
    },
    {
      categoryId: categories[1].id,
      amount: txAmount < 0 ? -part2 : part2,
      memo: "Mock Split 2 (Dining)"
    }
  ];
}

export function getMockNormalizedPayees(payees: string[]): Record<string, string> {
  const normalized: Record<string, string> = {};
  payees.forEach(payee => {
    // Clean Joe's or Starbucks
    let clean = payee;
    if (payee.toLowerCase().includes("starbucks")) clean = "Starbucks Coffee";
    else if (payee.toLowerCase().includes("amazon")) clean = "Amazon.com";
    else if (payee.toLowerCase().includes("walmart")) clean = "Walmart Supercenter";
    else if (payee.toLowerCase().includes("lowes")) clean = "Lowe's Home Improvement";
    else if (payee.toLowerCase().includes("netflix")) clean = "Netflix Subscription";
    
    normalized[payee] = clean;
  });
  return normalized;
}

export function getMockSubscriptions() {
  return {
    subscriptions: [
      {
        name: "Netflix",
        monthlyCost: 15.49,
        frequency: "MONTHLY",
        categoryName: "Entertainment",
        reason: "Detected recurring billing pattern from Netflix Inc."
      },
      {
        name: "Gym Membership",
        monthlyCost: 45.00,
        frequency: "MONTHLY",
        categoryName: "Health & Fitness",
        reason: "Detected recurring monthly payment to Gold's Gym"
      }
    ]
  };
}
