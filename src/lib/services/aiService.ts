import OpenAI from "openai";
import { Category, Prisma } from "@prisma/client";
import { logger } from "../logger";
import prisma from "@/lib/prisma";
import {
  isMockMode,
  getMockAiCategorize,
  getMockNormalizedPayees,
  getMockSubscriptions
} from "./mockService";

let isChatIdSupported = true;

type CustomChatCompletionCreateParams = OpenAI.Chat.ChatCompletionCreateParams & {
  chat_id?: string;
  reasoning_effort?: "low" | "medium" | "high";
};

async function getAiConfig() {
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  
  if (!settings || !settings.aiEnabled) {
    return null;
  }

  let baseURL = settings.aiBaseUrl || process.env.OPENAI_BASE_URL || "http://localhost:11434/v1";
  
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

  const apiKey = settings.aiApiKey || process.env.OPENAI_API_KEY || "sk-placeholder";
  const model = settings.aiModel || process.env.AI_MODEL || "gemma4:e4b";
  const chatId = settings.aiChatId || process.env.OPENAI_CHAT_ID || process.env.AI_CHAT_ID || (
    (baseURL.includes("webui") || baseURL.includes("ollama")) ? "webbudget-session-id" : undefined
  );
  
  const thinkingEnabled = settings.aiThinkingEnabled || false;
  const thinkingEffort = settings.aiThinkingEffort || null;

  return {
    baseURL,
    apiKey,
    model,
    chatId,
    thinkingEnabled,
    thinkingEffort,
  };
}

export interface SubscriptionTxInput {
  date: Date | string;
  payee: string;
  amount: number | string | Prisma.Decimal;
}

export interface SubscriptionResult {
  name: string;
  monthlyCost: number;
  confidence: number;
  reason: string;
}

export interface CategorizeTxInput {
  id: string;
  payee: string;
  amount: number | string | Prisma.Decimal;
}

export interface CategorizeExampleInput {
  payee: string;
  categoryName: string;
}

export interface MerchantCleanExample {
  raw: string;
  clean: string;
}

/**
 * Helper to call openai.chat.completions.create with centralized chat_id and model configuration.
 */
async function createChatCompletion(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[], jsonMode = true) {
  const config = await getAiConfig();
  if (!config) {
    throw new Error("AI is disabled");
  }

  const openai = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const params: CustomChatCompletionCreateParams = {
    model: config.model,
    messages,
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  };

  // Only pass chat_id if it is explicitly configured (for Open WebUI custom domains) or implicitly detected
  if (config.chatId && isChatIdSupported) {
    params.chat_id = config.chatId;
  }

  if (config.thinkingEnabled && config.thinkingEffort) {
    params.reasoning_effort = config.thinkingEffort as "low" | "medium" | "high";
  }

  try {
    return await openai.chat.completions.create(params);
  } catch (error) {
    const err = error as { message?: string; status?: number };
    const errorMessage = err?.message || "";
    const errorStatus = err?.status;

    // Detect if the error is due to an unrecognized parameter (like chat_id)
    const isParamError = 
      errorStatus === 400 && 
      (errorMessage.toLowerCase().includes("chat_id") || 
       errorMessage.toLowerCase().includes("extra_fields") || 
       errorMessage.toLowerCase().includes("unknown parameter") ||
       errorMessage.toLowerCase().includes("unrecognized") ||
       errorMessage.toLowerCase().includes("invalid parameter"));

    if (params.chat_id && isParamError) {
      logger.warn("AI", `Provider at ${config.baseURL} rejected 'chat_id' parameter. Retrying without it and disabling it for this session...`);
      isChatIdSupported = false;
      const cleanParams = { ...params };
      delete cleanParams.chat_id;
      return await openai.chat.completions.create(cleanParams);
    }

    throw error;
  }
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
  if (isMockMode()) {
    return getMockNormalizedPayees(titles);
  }

  const config = await getAiConfig();
  if (!config) {
    return titles.reduce((acc, title) => ({ ...acc, [title]: title }), {});
  }

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
      logger.error("AI", "Failed to parse JSON response from LLM", parseError);
      return titles.reduce((acc, title) => ({ ...acc, [title]: title }), {});
    }
  } catch (error) {
    logger.error("AI", "LLM normalization failed", error);
    return titles.reduce((acc, title) => ({ ...acc, [title]: title }), {});
  }
}

/**
 * Detects recurring subscriptions from a list of transactions.
 */
export async function detectSubscriptions(transactions: SubscriptionTxInput[]): Promise<SubscriptionResult[]> {
  if (isMockMode()) {
    return getMockSubscriptions().subscriptions as any;
  }
  const config = await getAiConfig();
  if (!config) return [];
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
    logger.error("AI", "detectSubscriptions failed", error);
    return [];
  }
}

/**
 * Suggests categories for a list of transactions based on existing categories and examples.
 */
export async function getCategorySuggestions(transactions: CategorizeTxInput[], categories: Category[], examples: CategorizeExampleInput[] = []): Promise<Record<string, string>> {
  if (transactions.length === 0) return {};
  if (isMockMode()) {
    return getMockAiCategorize(transactions.map(t => t.id), categories);
  }

  const config = await getAiConfig();
  if (!config) return {};

  const CHUNK_SIZE = 15;
  const chunks: CategorizeTxInput[][] = [];
  for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
    chunks.push(transactions.slice(i, i + CHUNK_SIZE));
  }

  const results: Record<string, string> = {};

  const promises = chunks.map(async (chunk) => {
    const prompt = `
Suggest the best category for each transaction based on the following categories and examples.
Return a JSON object where keys are transaction IDs and values are category names.

Categories: ${categories.map(c => c.name).join(", ")}

Examples:
${examples.map(ex => `- ${ex.payee} -> ${ex.categoryName}`).join("\n")}

Transactions to categorize:
${chunk.map(tx => `- ID: ${tx.id}, Payee: ${tx.payee}, Amount: ${tx.amount}`).join("\n")}

Format the response as valid JSON only.
`;

    try {
      const response = await createChatCompletion([
        { role: "system", content: "You are a budgeting assistant." },
        { role: "user", content: prompt }
      ]);
      const content = response.choices[0].message.content || "{}";
      return JSON.parse(cleanJsonContent(content));
    } catch (err) {
      logger.error("AI", "Chunk categorization failed", err);
      return {};
    }
  });

  try {
    const resolved = await Promise.all(promises);
    for (const map of resolved) {
      Object.assign(results, map);
    }
  } catch (error) {
    logger.error("AI", "getCategorySuggestions batch processing failed", error);
  }

  return results;
}

/**
 * Cleans a raw merchant name from bank data into a human-readable payee name.
 */
export async function getCleanMerchantName(rawPayee: string, examples: MerchantCleanExample[] = []): Promise<string> {
  if (isMockMode()) {
    return getMockNormalizedPayees([rawPayee])[rawPayee] || rawPayee;
  }
  const config = await getAiConfig();
  if (!config) return rawPayee;
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
    logger.error("AI", "getCleanMerchantName failed", error);
    return rawPayee;
  }
}

/**
 * Normalizes multiple raw merchant names in a single batch call.
 */
export async function getCleanMerchantNamesBatch(rawPayees: string[], examples: MerchantCleanExample[] = []): Promise<Record<string, string>> {
  if (rawPayees.length === 0) return {};
  if (isMockMode()) {
    return getMockNormalizedPayees(rawPayees);
  }

  const config = await getAiConfig();
  if (!config) {
    return rawPayees.reduce((acc, p) => ({ ...acc, [p]: p }), {});
  }

  // Deduplicate raw payees to avoid redundant translation
  const uniqueRawPayees = Array.from(new Set(rawPayees));

  const prompt = `
Clean the following raw merchant names from bank data into clean, human-readable payee names (e.g., "AMZN Mktp US*123" -> "Amazon", "WAL-MART #3219" -> "Walmart").
Return a JSON object where the keys are the original raw names and the values are the clean normalized names.

Recent example mappings:
${examples.map(ex => `- ${ex.raw} -> ${ex.clean}`).join("\n")}

Names to clean:
${uniqueRawPayees.map(p => `- ${p}`).join("\n")}

Format the response as valid JSON only.
`;

  try {
    const response = await createChatCompletion([
      { role: "system", content: "You are an expert financial data cleaner. You normalize raw merchant names into clean, concise payee names." },
      { role: "user", content: prompt }
    ]);
    const content = response.choices[0].message.content || "{}";
    const data = JSON.parse(cleanJsonContent(content));
    
    const result: Record<string, string> = {};
    for (const raw of rawPayees) {
      result[raw] = data[raw] || raw;
    }
    return result;
  } catch (error) {
    logger.error("AI", "getCleanMerchantNamesBatch failed", error);
    return rawPayees.reduce((acc, p) => ({ ...acc, [p]: p }), {});
  }
}


/**
 * Suggests transaction splits for an order with multiple items.
 */
export async function getSplitSuggestions(
  transaction: { amount: number | string | Prisma.Decimal },
  items: { title: string, price: number }[],
  categories: Category[]
): Promise<{ splits: { title: string, price: number, categoryName: string }[] }> {
  if (isMockMode()) {
    const mockSplits = items.map((item, idx) => ({
      title: item.title,
      price: item.price,
      categoryName: categories[idx % categories.length]?.name || "Uncategorized"
    }));
    return { splits: mockSplits };
  }
  const config = await getAiConfig();
  if (!config) return { splits: [] };
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
    logger.error("AI", "getSplitSuggestions failed", error);
    return { splits: [] };
  }
}

/**
 * Suggests historical mappings for importing data from spreadsheets.
 */
export async function suggestHistoricalMapping(
  sheetInfo: Record<string, unknown>[],
  categories: Category[]
): Promise<{ mappings: { sheetName: string; categoryMappings: Record<string, string> }[] }> {
  const config = await getAiConfig();
  if (!config) return { mappings: [] };
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
    logger.error("AI", "suggestHistoricalMapping failed", error);
    return { mappings: [] };
  }
}
