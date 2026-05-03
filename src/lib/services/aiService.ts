import OpenAI from "openai";
import { Category, Transaction } from "@/types";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      return null;
    }
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });
  }
  return _openai;
}

export async function getCategorySuggestions(
  transactions: Transaction[], 
  categories: Category[],
  examples: { payee: string, categoryName: string }[] = []
) {
  const categoryList = categories.map(c => `${c.id}: ${c.name}`).join("\n");
  
  const exampleText = examples.length > 0 
    ? `\nExamples of how this user has categorized items in the past:\n${examples.map(ex => `- ${ex.payee} -> ${ex.categoryName}`).join("\n")}\n`
    : "";

  const prompt = `
    You are a professional budgeting assistant. Your task is to categorize bank transactions.
    ${exampleText}
    
    Available Categories (ID: Name):
    ${categoryList}
    
    Transactions to categorize:
    ${transactions.map(tx => `ID: ${tx.id}, Payee: ${tx.payee}, Amount: ${tx.amount}`).join("\n")}
    
    Return a JSON object where keys are Transaction IDs and values are the suggested Category IDs from the list above.
    Only return the JSON object, nothing else.
  `;

  try {
    const ai = getOpenAI();
    if (!ai) return {};
    const response = await ai.chat.completions.create({
      model: process.env.AI_MODEL || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant that returns strictly formatted JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) return {};

    // Resilience: Clean up common LLM markdown wrapping
    const cleanJson = content.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("AI Categorization Error:", error);
    return {};
  }
}

export async function getSplitSuggestions(
  transaction: any, 
  items: { title: string, price: number }[], 
  categories: Category[]
) {
  const categoryList = categories.map(c => `${c.id}: ${c.name}`).join("\n");
  
  const prompt = `
    You are a professional budgeting assistant. A transaction for $${Math.abs(Number(transaction.amount))} at ${transaction.payee} contains multiple items.
    
    Available Categories (ID: Name):
    ${categoryList}
    
    Items in this purchase:
    ${items.map(item => `- ${item.title}: $${item.price}`).join("\n")}
    
    Your task:
    1. Map each item to the most relevant Category ID from the list.
    2. Ensure the sum of all splits equals the total transaction amount ($${Math.abs(Number(transaction.amount))}).
    3. If there is a discrepancy (like tax or shipping), distribute it proportionally or assign it to a "General" or most relevant category.
    
    Return a JSON object with a "splits" array. Each split should have:
    - categoryId: The ID of the category.
    - amount: The decimal amount.
    - memo: A brief description (e.g., the item name).
    
    Only return the JSON object.
  `;

  try {
    const ai = getOpenAI();
    if (!ai) return {};
    const response = await ai.chat.completions.create({
      model: process.env.AI_MODEL || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant that returns strictly formatted JSON." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) return { splits: [] };

    // Resilience: Clean up common LLM markdown wrapping
    const cleanJson = content.replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    if (parsed.splits && Array.isArray(parsed.splits)) {
      const txAmount = Math.abs(Number(transaction.amount));
      const suggestedTotal = parsed.splits.reduce((acc: number, s: any) => acc + Number(s.amount), 0);

      // Math Correction: If the LLM is slightly off, adjust the largest split
      if (Math.abs(suggestedTotal - txAmount) > 0 && Math.abs(suggestedTotal - txAmount) < 1.0) {
        const diff = txAmount - suggestedTotal;
        const largestIdx = parsed.splits.reduce((best: number, s: any, i: number) => 
          Number(s.amount) > Number(parsed.splits[best].amount) ? i : best, 0);
        
        parsed.splits[largestIdx].amount = Number(parsed.splits[largestIdx].amount) + diff;
      }
    }

    return parsed;
  } catch (error) {
    console.error("AI Split Error:", error);
    return { splits: [] };
  }
}

export async function detectSubscriptions(transactions: any[]) {
  // Pre-filter: Only look at merchants that appear more than once in the last 90 days
  const merchantCounts = new Map<string, any[]>();
  for (const tx of transactions) {
    if (Number(tx.amount) >= 0) continue; // Skip deposits
    const list = merchantCounts.get(tx.payee) || [];
    list.push(tx);
    merchantCounts.set(tx.payee, list);
  }

  const candidates = Array.from(merchantCounts.entries())
    .filter(([_, txs]) => txs.length >= 2)
    .map(([payee, txs]) => ({
      payee,
      count: txs.length,
      avgAmount: Math.abs(txs.reduce((acc, t) => acc + Number(t.amount), 0) / txs.length).toFixed(2),
      examples: txs.slice(0, 2).map(t => `${new Date(t.date).toLocaleDateString()}: $${Math.abs(Number(t.amount))}`)
    }));

  if (candidates.length === 0) return { subscriptions: [] };

  const prompt = `
    Analyze these recurring transactions and identify which ones are likely "Subscriptions" (SaaS, Gym, Netflix, Utilities, etc.).
    
    Transactions:
    ${JSON.stringify(candidates)}
    
    Return a JSON object with a "subscriptions" array. Each subscription should have:
    - name: The merchant name.
    - monthlyCost: The estimated monthly cost.
    - confidence: "High" or "Medium".
    - reason: Why you think it's a subscription.
    
    Only return JSON.
  `;

  try {
    const ai = getOpenAI();
    if (!ai) return {};
    const response = await ai.chat.completions.create({
      model: process.env.AI_MODEL || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant that identifies recurring subscriptions from financial data." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) return { subscriptions: [] };

    return JSON.parse(content.replace(/```json\n?|```/g, "").trim());
  } catch (error) {
    console.error("Subscription Detection Error:", error);
    return { subscriptions: [] };
  }
}

export async function getCleanMerchantName(rawPayee: string, examples: { raw: string, clean: string }[] = []) {
  const exampleText = examples.length > 0
    ? `\nHere are some examples of how you have cleaned similar names before:\n${examples.map(ex => `- ${ex.raw} -> ${ex.clean}`).join("\n")}\n`
    : "";

  const prompt = `
    You are a professional financial assistant. Your task is to transform a cryptic bank transaction memo into a clean, human-readable merchant name.
    
    Rules:
    1. Remove transaction IDs, store numbers, cities, and dates (e.g., "SQ * STEVE'S TRUCK 123 CA" -> "Steve's Truck").
    2. Capitalize properly.
    3. Keep it concise.
    ${exampleText}
    
    Raw Memo: "${rawPayee}"
    
    Return ONLY the cleaned merchant name. No JSON, no extra text.
  `;

  try {
    const ai = getOpenAI();
    if (!ai) return rawPayee;
    const response = await ai.chat.completions.create({
      model: process.env.AI_MODEL || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant that cleans bank memos." },
        { role: "user", content: prompt }
      ],
    });

    return response.choices[0].message.content?.trim() || rawPayee;
  } catch (error) {
    console.error("AI Merchant Cleanup Error:", error);
    return rawPayee;
  }
}

export async function suggestHistoricalMapping(
  sheetInfo: { name: string, headers: string[], samples: any[] }[],
  categories: Category[]
) {
  const categoryList = categories.map(c => c.name).join(", ");
  
  const prompt = `
    You are a data engineering assistant. I am importing historical financial data from an XLSX file into my budget app.
    The spreadsheet has multiple tabs (sheets), and each tab likely represents a category or a group of transactions.
    
    Current App Categories: ${categoryList}
    
    Spreadsheet Structure:
    ${sheetInfo.map(s => `
      Sheet: "${s.name}"
      Headers: ${s.headers.join(", ")}
      Sample Rows: ${JSON.stringify(s.samples)}
    `).join("\n")}
    
    Your Task:
    1. For each sheet, determine if it contains transactions.
    2. If it does, map it to the most relevant "Current App Category". If no good match exists, suggest a new category name.
    3. Identify which column represents the DATE, which represents the PAYEE/DESCRIPTION, and which represents the AMOUNT.
    
    Return a JSON object with a "mappings" array. Each mapping should have:
    - sheetName: The original sheet name.
    - isTransactionSheet: boolean.
    - suggestedCategory: The name of the category to map to.
    - dateColumn: The header name for the date.
    - payeeColumn: The header name for the payee/description.
    - amountColumn: The header name for the amount.
    
    Only return the JSON object.
  `;

  try {
    const ai = getOpenAI();
    if (!ai) return { mappings: [] };
    const response = await ai.chat.completions.create({
      model: process.env.AI_MODEL || "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant that maps spreadsheet data to application schemas." },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) return { mappings: [] };
    return JSON.parse(content.replace(/```json\n?|```/g, "").trim());
  } catch (error) {
    console.error("AI Mapping Error:", error);
    return { mappings: [] };
  }
}


