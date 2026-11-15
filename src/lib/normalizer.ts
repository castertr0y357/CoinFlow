import { Prisma } from "@prisma/client";

export interface SubscriptionCandidate {
  id?: string;
  date: Date | string;
  payee: string;
  amount: number | string | Prisma.Decimal;
}

export interface DetectedSubscription {
  name: string;
  monthlyCost: number;
  confidence: number;
  reason: string;
}

const CANONICAL_MERCHANT_RULES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\b(amzn|amazon|amazon\.com|amzn mktp)\b/i, name: "Amazon" },
  { pattern: /\b(wal-mart|walmart|wm supercenter|wm\.com)\b|^wm\s+/i, name: "Walmart" },
  { pattern: /\b(lowe'?s|lowes)\b/i, name: "Lowe's" },
  { pattern: /\btarget\b/i, name: "Target" },
  { pattern: /\bcostco\b/i, name: "Costco" },
  { pattern: /\bhome\s*depot\b/i, name: "Home Depot" },
  { pattern: /\bkroger\b/i, name: "Kroger" },
  { pattern: /\baldi\b/i, name: "Aldi" },
  { pattern: /\btrader\s*joe'?s\b/i, name: "Trader Joe's" },
  { pattern: /\bwhole\s*foods\b/i, name: "Whole Foods" },
  { pattern: /\bstarbucks\b/i, name: "Starbucks" },
  { pattern: /\bmcdonald'?s\b/i, name: "McDonald's" },
  { pattern: /\bchick-fil-a\b/i, name: "Chick-fil-A" },
  { pattern: /\bnetflix\b/i, name: "Netflix" },
  { pattern: /\bspotify\b/i, name: "Spotify" },
  { pattern: /\bapple\.com\/bill\b|\bitunes\b/i, name: "Apple" },
  { pattern: /\bgoogle\s*\*?\s*(one|play|storage|youtube|fi)\b/i, name: "Google" },
  { pattern: /\byoutube\b/i, name: "YouTube" },
  { pattern: /\bhulu\b/i, name: "Hulu" },
  { pattern: /\bdisney\s*\+?\b/i, name: "Disney+" },
  { pattern: /\buber\s*eats\b/i, name: "Uber Eats" },
  { pattern: /\buber\b/i, name: "Uber" },
  { pattern: /\blyft\b/i, name: "Lyft" },
  { pattern: /\bdoordash\b/i, name: "DoorDash" },
  { pattern: /\bshell\b/i, name: "Shell" },
  { pattern: /\bchevron\b/i, name: "Chevron" },
  { pattern: /\bexxon\b/i, name: "Exxon" },
  { pattern: /\bcvs\b/i, name: "CVS" },
  { pattern: /\bwalgreens\b/i, name: "Walgreens" },
  { pattern: /\bverizon\b/i, name: "Verizon" },
  { pattern: /\bat&t\b|\batt\b/i, name: "AT&T" },
  { pattern: /\bt-mobile\b/i, name: "T-Mobile" },
];

function toTitleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 2 && /^[a-z]+$/.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

/**
 * Fast, deterministic merchant name normalizer.
 * Checks historical rawPayee -> payee mappings first, then applies canonical
 * merchant rules and POS/reference-code stripping.
 */
export function cleanMerchantNameDeterministic(
  rawPayee: string,
  historyMap?: Map<string, string>
): string {
  if (!rawPayee) return "";
  const trimmed = rawPayee.trim();
  if (!trimmed) return "";

  if (historyMap && historyMap.has(trimmed)) {
    const cached = historyMap.get(trimmed);
    if (cached && cached.trim()) return cached;
  }

  for (const rule of CANONICAL_MERCHANT_RULES) {
    if (rule.pattern.test(trimmed)) {
      return rule.name;
    }
  }

  let cleaned = trimmed
    // Strip common POS/payment processor prefixes
    .replace(/^(sq\s*\*|tst\s*\*|sp\s*\*|paypal\s*\*|pp\s*\*|apl\s*\*|google\s*\*|pos\s+debit\s+|checkcard\s+\d*\s*|ach\s+debit\s+|purchase\s+authorized\s+on\s+\d{2}\/\d{2}\s*)/i, "")
    // Strip trailing reference codes like *1A2B3C4D
    .replace(/\*[a-z0-9]{4,}$/i, "")
    // Strip store numbers like #1234 or #0045
    .replace(/#\s*\d+\b/g, "")
    // Strip phone numbers
    .replace(/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, "")
    // Strip trailing 2-letter US state + optional zip
    .replace(/\s+[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/, "")
    // Collapse multiple spaces
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned) {
    return trimmed;
  }

  // If all caps or all lowercase, normalize to Title Case
  if (cleaned === cleaned.toUpperCase() || cleaned === cleaned.toLowerCase()) {
    cleaned = toTitleCase(cleaned);
  }

  return cleaned;
}

/**
 * Fast, deterministic retail product title cleaner.
 * Strips SEO keyword stuffing and caps length cleanly without an LLM call.
 */
export function cleanRetailItemTitleDeterministic(rawTitle: string, maxLength = 75): string {
  if (!rawTitle) return "";
  let cleaned = rawTitle.trim();

  // Strip leading bracketed tags like [2-Pack] or (Renewed)
  cleaned = cleaned.replace(/^\[[^\]]{1,25}\]\s*/g, "").trim();

  // If there's a pipe or " - " separator with a descriptive prefix, keep the primary product name
  const pipeIdx = cleaned.indexOf(" | ");
  if (pipeIdx >= 15) {
    cleaned = cleaned.slice(0, pipeIdx).trim();
  }

  const dashIdx = cleaned.indexOf(" - ");
  if (dashIdx >= 18) {
    cleaned = cleaned.slice(0, dashIdx).trim();
  }

  // Strip trailing comma-separated SEO fluff if the prefix is already descriptive
  const commaIdx = cleaned.indexOf(", ");
  if (commaIdx >= 15) {
    cleaned = cleaned.slice(0, commaIdx).trim();
  }

  if (cleaned.length > maxLength) {
    const truncated = cleaned.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    cleaned = (lastSpace > 20 ? truncated.slice(0, lastSpace) : truncated).trim();
  }

  return cleaned || rawTitle.trim();
}

/**
 * Deterministic recurring subscription detector.
 * Groups outflow transactions by normalized payee and evaluates cadence & amount consistency.
 */
export function detectSubscriptionsDeterministic(
  transactions: SubscriptionCandidate[]
): DetectedSubscription[] {
  const groups = new Map<string, Array<{ date: Date; amount: number; displayPayee: string }>>();

  for (const tx of transactions) {
    const amt = Number(tx.amount);
    // Subscriptions are outflows (negative amounts)
    if (isNaN(amt) || amt >= 0) continue;

    const absAmount = Math.abs(amt);
    const txDate = tx.date instanceof Date ? tx.date : new Date(tx.date);
    if (isNaN(txDate.getTime())) continue;

    const key = cleanMerchantNameDeterministic(tx.payee).toLowerCase();
    if (!key) continue;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push({
      date: txDate,
      amount: absAmount,
      displayPayee: cleanMerchantNameDeterministic(tx.payee),
    });
  }

  const results: DetectedSubscription[] = [];

  for (const [, entries] of groups.entries()) {
    if (entries.length < 2) continue;

    // Sort chronologically ascending
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Calculate intervals in days between consecutive charges
    const intervals: number[] = [];
    for (let i = 1; i < entries.length; i++) {
      const diffDays = (entries[i].date.getTime() - entries[i - 1].date.getTime()) / (1000 * 60 * 60 * 24);
      // Ignore same-day duplicate/split charges
      if (diffDays >= 3) {
        intervals.push(diffDays);
      }
    }

    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((sum, d) => sum + d, 0) / intervals.length;
    const avgAmount = entries.reduce((sum, e) => sum + e.amount, 0) / entries.length;

    // Check amount consistency (within ±15% of average)
    const maxDeviation = Math.max(...entries.map((e) => Math.abs(e.amount - avgAmount) / (avgAmount || 1)));
    if (maxDeviation > 0.15) continue;

    let cadenceLabel: string | null = null;
    let monthlyMultiplier = 1;

    if (avgInterval >= 25 && avgInterval <= 35) {
      cadenceLabel = "monthly";
      monthlyMultiplier = 1;
    } else if (avgInterval >= 12 && avgInterval <= 16) {
      cadenceLabel = "bi-weekly";
      monthlyMultiplier = 2.167;
    } else if (avgInterval >= 6 && avgInterval <= 8) {
      cadenceLabel = "weekly";
      monthlyMultiplier = 4.333;
    }

    if (!cadenceLabel) continue;

    // Confidence score (0.65 - 0.99)
    let confidence = 0.72;
    if (entries.length >= 3) confidence += 0.12;
    if (maxDeviation <= 0.02) confidence += 0.1;
    if (cadenceLabel === "monthly" && Math.abs(avgInterval - 30) <= 2) confidence += 0.05;
    confidence = Math.min(0.99, Number(confidence.toFixed(2)));

    const monthlyCost = Number((avgAmount * monthlyMultiplier).toFixed(2));
    const roundedInterval = Math.round(avgInterval);

    results.push({
      name: entries[entries.length - 1].displayPayee,
      monthlyCost,
      confidence,
      reason: `${entries.length} ${cadenceLabel} charges averaging $${avgAmount.toFixed(2)} every ~${roundedInterval} days`,
    });
  }

  return results.sort((a, b) => b.monthlyCost - a.monthlyCost);
}

const MULTI_CATEGORY_RETAILERS = [
  "amazon",
  "walmart",
  "target",
  "costco",
  "sam's club",
  "sams club",
  "lowe's",
  "lowes",
  "home depot",
];

/**
 * Checks whether a merchant is a multi-category retailer that should wait for
 * retail order item splitting rather than being auto-categorized to one bucket.
 */
export function isMultiCategoryRetailer(payee: string): boolean {
  const lower = payee.toLowerCase();
  return MULTI_CATEGORY_RETAILERS.some((r) => lower.includes(r));
}

export interface PayeeMemoryInput {
  commitments: Array<{ name: string; categoryId: string | null }>;
  historicalSplits: Array<{ payee: string; categoryId: string }>;
}

/**
 * Builds a deterministic normalized-payee -> categoryId lookup map from:
 * 1) Active commitments with an assigned categoryId
 * 2) Historical categorized transactions (>= 2 occurrences with >= 75% consistency)
 */
export function buildPayeeCategoryMemory(input: PayeeMemoryInput): Map<string, string> {
  const memory = new Map<string, string>();

  // 1. Commitments are explicit user-defined recurring rules
  for (const comm of input.commitments) {
    if (!comm.categoryId || !comm.name) continue;
    const key = cleanMerchantNameDeterministic(comm.name).toLowerCase().trim();
    if (key && !isMultiCategoryRetailer(key)) {
      memory.set(key, comm.categoryId);
    }
  }

  // 2. Historical categorized single-split transactions
  const counts = new Map<string, Map<string, number>>();
  for (const item of input.historicalSplits) {
    if (!item.categoryId || !item.payee) continue;
    const key = cleanMerchantNameDeterministic(item.payee).toLowerCase().trim();
    if (!key || isMultiCategoryRetailer(key)) continue;

    if (!counts.has(key)) counts.set(key, new Map());
    const catMap = counts.get(key)!;
    catMap.set(item.categoryId, (catMap.get(item.categoryId) || 0) + 1);
  }

  for (const [key, catMap] of counts.entries()) {
    if (memory.has(key)) continue;
    let total = 0;
    let topCategoryId = "";
    let topCount = 0;

    for (const [catId, count] of catMap.entries()) {
      total += count;
      if (count > topCount) {
        topCount = count;
        topCategoryId = catId;
      }
    }

    if (total >= 2 && topCount / total >= 0.75 && topCategoryId) {
      memory.set(key, topCategoryId);
    }
  }

  return memory;
}

const RETAIL_KEYWORD_GROUPS: Array<{ keywords: string[]; categoryHints: string[] }> = [
  {
    keywords: ["grocery", "food", "snack", "coffee", "tea", "milk", "bread", "cereal", "pasta", "sauce", "meat", "chicken", "fruit", "vegetable", "cheese", "water", "juice", "soda", "chip", "cookie", "protein", "oat", "olive oil"],
    categoryHints: ["grocer", "food", "pantry", "dining"],
  },
  {
    keywords: ["paper towel", "toilet paper", "detergent", "soap", "cleaner", "bleach", "sponge", "trash bag", "dish", "laundry", "tissues", "foil", "ziploc", "batteries", "light bulb", "lightbulb"],
    categoryHints: ["household", "home", "supplies", "cleaning", "essential"],
  },
  {
    keywords: ["dog", "cat", "pet", "litter", "kibble", "treat", "leash", "collar"],
    categoryHints: ["pet", "dog", "cat", "animal"],
  },
  {
    keywords: ["vitamin", "supplement", "medicine", "ibuprofen", "tylenol", "bandage", "toothpaste", "toothbrush", "shampoo", "conditioner", "deodorant", "lotion", "sunscreen", "razor", "pharmacy"],
    categoryHints: ["health", "medical", "pharmacy", "personal", "hygiene", "care"],
  },
  {
    keywords: ["shirt", "pants", "jeans", "socks", "shoes", "jacket", "coat", "dress", "hoodie", "underwear", "sneaker", "apparel"],
    categoryHints: ["cloth", "apparel", "wardrobe", "fashion", "personal"],
  },
  {
    keywords: ["cable", "charger", "usb", "hdmi", "adapter", "keyboard", "mouse", "headphone", "earbud", "speaker", "monitor", "ssd", "router", "electronics"],
    categoryHints: ["tech", "electronic", "computer", "gadget", "office"],
  },
  {
    keywords: ["drill", "screw", "hammer", "wrench", "paint", "brush", "tape", "lumber", "mulch", "hose", "garden", "soil", "seed", "filter", "hardware", "plumbing"],
    categoryHints: ["home", "hardware", "improvement", "maintenance", "garden", "yard", "house"],
  },
  {
    keywords: ["diaper", "wipes", "formula", "baby", "stroller", "pacifier", "toy", "lego", "puzzle"],
    categoryHints: ["kid", "child", "baby", "family", "toy"],
  },
  {
    keywords: ["book", "kindle", "game", "board game", "blu-ray", "movie", "music"],
    categoryHints: ["entertain", "book", "media", "fun", "hobby", "recreation"],
  },
];

/**
 * Deterministically suggests a category name for a retail order item title
 * using past categorized split memos first, then category name & retail keyword matching.
 */
export function suggestItemCategoryDeterministic(
  itemTitle: string,
  categories: Array<{ id: string; name: string }>,
  pastMemos: Array<{ memo: string; categoryName: string }>
): string | null {
  const lowerTitle = itemTitle.toLowerCase().trim();
  if (!lowerTitle || categories.length === 0) return null;

  const validCatNames = new Set(categories.map((c) => c.name));

  // 1. Exact or strong substring match against past categorized item memos
  const titleWords = lowerTitle.split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  for (const past of pastMemos) {
    if (!validCatNames.has(past.categoryName)) continue;
    const pastLower = past.memo.toLowerCase().trim();
    if (!pastLower) continue;
    if (pastLower === lowerTitle || (pastLower.length >= 8 && lowerTitle.includes(pastLower))) {
      return past.categoryName;
    }
    if (titleWords.length >= 2) {
      const pastWords = new Set(pastLower.split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
      let overlap = 0;
      for (const w of titleWords) {
        if (pastWords.has(w)) overlap++;
      }
      if (overlap >= 2) return past.categoryName;
    }
  }

  // 2. Direct category name token match in item title
  for (const cat of categories) {
    const catLower = cat.name.toLowerCase().trim();
    if (catLower.length >= 4 && lowerTitle.includes(catLower)) {
      return cat.name;
    }
  }

  // 3. Retail keyword dictionary -> user's matching category name
  for (const group of RETAIL_KEYWORD_GROUPS) {
    const hasKeyword = group.keywords.some((kw) => lowerTitle.includes(kw));
    if (!hasKeyword) continue;

    const matchedCat = categories.find((cat) => {
      const catLower = cat.name.toLowerCase();
      return group.categoryHints.some((hint) => catLower.includes(hint));
    });
    if (matchedCat) return matchedCat.name;
  }

  return null;
}
