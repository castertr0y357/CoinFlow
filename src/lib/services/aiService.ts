import OpenAI from "openai";

let baseURL = process.env.OPENAI_BASE_URL || "http://localhost:11434/v1";

// Auto-upgrade remote non-localhost endpoints to HTTPS to avoid HTTP-to-HTTPS redirects breaking POST requests
if (baseURL.startsWith("http://") && 
    !baseURL.includes("localhost") && 
    !baseURL.includes("127.0.0.1") && 
    !baseURL.includes("192.168.") && 
    !baseURL.includes("10.") && 
    !baseURL.includes("::1")) {
  const hostname = baseURL.replace("http://", "").split("/")[0].split(":")[0];
  if (hostname.includes(".")) {
    baseURL = baseURL.replace("http://", "https://");
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder",
  baseURL,
});

const MODEL = process.env.AI_MODEL || "gemma4:e4b";

const CHAT_ID = process.env.OPENAI_CHAT_ID || process.env.AI_CHAT_ID || (
  (baseURL.includes("webui") || baseURL.includes("ollama")) ? "webbudget-session-id" : undefined
);

/**
 * Helper to call openai.chat.completions.create with centralized chat_id and model configuration.
 */
async function createChatCompletion(messages: any[], jsonMode = true) {
  return openai.chat.completions.create({
    model: MODEL,
    messages,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    ...(CHAT_ID ? { extra_body: { chat_id: CHAT_ID } } : {}),
  });
}

function cleanJsonContent(content: string): string {
  let cleaned = content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, "");
    cleaned = cleaned.replace(/\s*```$/, "");
  }
  return cleaned.trim();
}

/**
 * Normalizes retail product titles into clean, concise names.
 */
export async function normalizeItemNames(titles: string[]): Promise<Record<string, string>> {
  if (titles.length === 0) return {};

  const prompt = `
Normalize the following Amazon/retail item titles into clean, concise, and descriptive product names.
Remove version numbers, generation info, colors, and marketing fluff unless essential to identify the item.
Return a JSON object where the keys are the original titles and the values are the normalized titles.

Items to normalize:
${titles.map(t => `- ${t}`).join("\n")}

Format the response as valid JSON only.
`;

  try {
    const response = await createChatCompletion([
      { role: "system", content: "You are a helpful assistant that normalizes retail product titles into clean, concise names." },
      { role: "user", content: prompt }
    ]);

    const content = response.choices[0].message.content;
    if (!content) return {};

    try {
      const normalizedMap = JSON.parse(cleanJsonContent(content));
      const result: Record<string, string> = {};
      for (const title of titles) {
        result[title] = normalizedMap[title] || title;
      }
      return result;
    } catch (parseError) {
      console.error("CoinFlow [AI]: Failed to parse JSON response from LLM:", parseError);
      return titles.reduce((acc, title) => ({ ...acc, [title]: title }), {});
    }
  } catch (error) {
    console.error("CoinFlow [AI]: LLM normalization failed:", error);
    return titles.reduce((acc, title) => ({ ...acc, [title]: title }), {});
  }
}

/**
 * Detects recurring subscriptions from a list of transactions.
 */
export async function detectSubscriptions(transactions: any[]): Promise<any[]> {
  const prompt = `
Analyze the following financial transactions and identify potential recurring subscriptions.
Return a JSON array of objects, each with 'name', 'monthlyCost', 'confidence', and 'reason'.

Transactions:
${transactions.map(tx => `- ${tx.date}: ${tx.payee} ($${tx.amount})`).join("\n")}

Format the response as valid JSON only.
`;

  try {
    const response = await createChatCompletion([
      { role: "system", content: "You are a financial analyst identifying subscriptions." },
      { role: "user", content: prompt }
    ]);
    const content = response.choices[0].message.content || "{\"subscriptions\": []}";
    const data = JSON.parse(cleanJsonContent(content));
    return data.subscriptions || [];
  } catch (error) {
    console.error("CoinFlow [AI]: detectSubscriptions failed:", error);
    return [];
  }
}

/**
 * Suggests categories for a list of transactions based on existing categories and examples.
 */
export async function getCategorySuggestions(transactions: any[], categories: any[], examples: any[] = []): Promise<Record<string, string>> {
  const prompt = `
Suggest the best category for each transaction based on the following categories and examples.
Return a JSON object where keys are transaction IDs and values are category names.

Categories: ${categories.map(c => c.name).join(", ")}

Examples:
${examples.map(ex => `- ${ex.payee} -> ${ex.categoryName}`).join("\n")}

Transactions to categorize:
${transactions.map(tx => `- ID: ${tx.id}, Payee: ${tx.payee}, Amount: ${tx.amount}`).join("\n")}

Format the response as valid JSON only.
`;

  try {
    const response = await createChatCompletion([
      { role: "system", content: "You are a budgeting assistant." },
      { role: "user", content: prompt }
    ]);
    const content = response.choices[0].message.content || "{}";
    return JSON.parse(cleanJsonContent(content));
  } catch (error) {
    console.error("CoinFlow [AI]: getCategorySuggestions failed:", error);
    return {};
  }
}

/**
 * Cleans a raw merchant name from bank data into a human-readable payee name.
 */
export async function getCleanMerchantName(rawPayee: string, examples: any[] = []): Promise<string> {
  const prompt = `
Clean this raw merchant name into a human-readable payee name (e.g., "AMZN Mktp US*123" -> "Amazon").
Return a JSON object with a single key 'cleanName'.

Raw Name: ${rawPayee}

Examples:
${examples.map(ex => `- ${ex.raw} -> ${ex.clean}`).join("\n")}

Format the response as valid JSON only.
`;

  try {
    const response = await createChatCompletion([
      { role: "system", content: "You are a data cleaner for bank transactions." },
      { role: "user", content: prompt }
    ]);
    const content = response.choices[0].message.content || "{\"cleanName\": \"\"}";
    const data = JSON.parse(cleanJsonContent(content));
    return data.cleanName || rawPayee;
  } catch (error) {
    console.error("CoinFlow [AI]: getCleanMerchantName failed:", error);
    return rawPayee;
  }
}

/**
 * Suggests transaction splits for an order with multiple items.
 */
export async function getSplitSuggestions(transaction: any, items: any[], categories: any[]): Promise<any> {
  const prompt = `
Suggest budget categories for each item in this order to split the transaction.
Return a JSON object with 'splits', which is an array of { title, price, categoryName }.

Total Amount: ${transaction.amount}
Items:
${items.map(i => `- ${i.title} ($${i.price})`).join("\n")}

Available Categories: ${categories.map(c => c.name).join(", ")}

Format the response as valid JSON only.
`;

  try {
    const response = await createChatCompletion([
      { role: "system", content: "You are a budgeting expert splitting transactions." },
      { role: "user", content: prompt }
    ]);
    const content = response.choices[0].message.content || "{\"splits\": []}";
    return JSON.parse(cleanJsonContent(content));
  } catch (error) {
    console.error("CoinFlow [AI]: getSplitSuggestions failed:", error);
    return { splits: [] };
  }
}

/**
 * Suggests historical mappings for importing data from spreadsheets.
 */
export async function suggestHistoricalMapping(sheetInfo: any[], categories: any[]): Promise<any> {
  const prompt = `
Analyze these spreadsheet headers and samples to suggest which sheet contains transactions and how to map its columns.
Return a JSON object with 'mappings', which is an array of mapping objects.

Available Categories: ${categories.map(c => c.name).join(", ")}

Sheet Info:
${JSON.stringify(sheetInfo, null, 2)}

Format the response as valid JSON only.
`;

  try {
    const response = await createChatCompletion([
      { role: "system", content: "You are an expert at data mapping and spreadsheet analysis." },
      { role: "user", content: prompt }
    ]);
    const content = response.choices[0].message.content || "{\"mappings\": []}";
    return JSON.parse(cleanJsonContent(content));
  } catch (error) {
    console.error("CoinFlow [AI]: suggestHistoricalMapping failed:", error);
    return { mappings: [] };
  }
}
