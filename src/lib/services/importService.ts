import prisma from "@/lib/prisma";
import { createHash } from "crypto";
import * as XLSX from "xlsx";
import { logger } from "@/lib/logger";
import { deleteHistoricalYear } from "@/lib/services/yearService";

export type SheetRole = "category" | "income" | "debit" | "charge";

export interface HistoricalMapping {
  sheetName: string;
  isTransactionSheet: boolean;
  sheetRole?: SheetRole;
  headerRowIndex: number; // 0-based row index of the header row
  headers: string[];
  suggestedCategory: string;
  dateColumn: string;
  payeeColumn: string;
  memoColumn: string;
  amountColumn: string;
  estimatedTransactionCount: number;
  skippedBudgetRowCount: number;
  detectedRollover: number | null;
  detectedMonthlyProvision: number | null;
}

export interface HistoricalImportOptions {
  skipBudgetRows?: boolean;
  applyRolloverAndBudget?: boolean;
  archiveNewCategories?: boolean;
}

const SKIPPED_SHEET_PATTERNS = [
  /budget/i,
  /^summary$/i,
  /^overview$/i,
  /^totals?$/i,
  /^transfers?$/i,
];

export function getLedgerSheetRole(name: string): SheetRole {
  const trimmed = name.trim();
  if (/^incomes?$/i.test(trimmed)) return "income";
  if (/^debits?$/i.test(trimmed)) return "debit";
  if (/^charges?$/i.test(trimmed)) return "charge";
  return "category";
}

function getDefaultLedgerCategoryName(role: SheetRole): string {
  if (role === "income") return "Historical Income";
  if (role === "debit") return "Direct Debits";
  if (role === "charge") return "Uncategorized Charges";
  return "";
}

export function consumeCrossSheetMatch(
  index: Map<string, { dateMs: number; consumed: boolean }[]>,
  date: Date,
  amount: number,
  windowDays: number = 2
): boolean {
  const key = Math.abs(amount).toFixed(2);
  const bucket = index.get(key);
  if (!bucket || bucket.length === 0) return false;

  const targetMs = date.getTime();
  const windowMs = windowDays * 86400 * 1000;
  for (const entry of bucket) {
    if (!entry.consumed && Math.abs(entry.dateMs - targetMs) <= windowMs) {
      entry.consumed = true;
      return true;
    }
  }
  return false;
}

const INTERNAL_BUDGET_ROW_PATTERNS = [
  /^year\s*start$/i,
  /^(january|february|march|april|may|june|july|august|september|october|november|december)\s+addition$/i,
  /^month\s*start\s*provision/i,
  /^boost$/i,
  /^adjustment$/i,
];

export function isSkippedSheetName(name: string): boolean {
  const trimmed = name.trim();
  return SKIPPED_SHEET_PATTERNS.some((re) => re.test(trimmed));
}

export function isInternalBudgetRow(description: string): boolean {
  const trimmed = description.trim();
  if (!trimmed) return false;
  return INTERNAL_BUDGET_ROW_PATTERNS.some((re) => re.test(trimmed));
}

export function parseExcelDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : raw;
  }
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 20000 && raw < 80000) {
    // Excel serial date (days since 1899-12-30)
    const utcMs = Math.round((raw - 25569) * 86400 * 1000);
    const d = new Date(utcMs);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(raw).trim();
  if (!str) return null;
  // Handle YYYY-MM-DD as UTC noon to avoid timezone day-shift
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const d = new Date(Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]), 12, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export function parseCurrencyAmount(raw: unknown): number {
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : NaN;
  }
  if (raw === null || raw === undefined) return NaN;
  const str = String(raw).trim();
  if (!str) return NaN;
  const isParenNegative = str.startsWith("(") && str.endsWith(")");
  const cleaned = str.replace(/[$,\s()]/g, "");
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return NaN;
  return isParenNegative ? -Math.abs(num) : num;
}

function normalizeNameForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function matchExistingCategory(sheetName: string, existingCategories: string[]): string {
  const normSheet = normalizeNameForMatch(sheetName);
  // 1. Exact normalized match (e.g. "Vitamins and Medicine" <-> "Vitamins & Medicine")
  for (const cat of existingCategories) {
    if (normalizeNameForMatch(cat) === normSheet) return cat;
  }
  // 2. Common abbreviations
  if (normSheet.includes("homeownersassociation") || normSheet === "hoa") {
    const hoa = existingCategories.find((c) => normalizeNameForMatch(c) === "hoa");
    if (hoa) return hoa;
  }
  // 3. Substring match if one clearly contains the other (min 4 chars)
  if (normSheet.length >= 4) {
    for (const cat of existingCategories) {
      const normCat = normalizeNameForMatch(cat);
      if (normCat.length >= 4 && (normSheet.includes(normCat) || normCat.includes(normSheet))) {
        return cat;
      }
    }
  }
  return sheetName.trim();
}

export function detectHeaderRow(rows: unknown[][]): {
  headerRowIndex: number;
  headers: string[];
  dateColumn: string;
  payeeColumn: string;
  memoColumn: string;
  amountColumn: string;
} | null {
  const scanLimit = Math.min(rows.length, 10);

  for (let r = 0; r < scanLimit; r++) {
    const row = rows[r] || [];
    const cells = row.map((c) => String(c ?? "").trim());
    const nonEmpty = cells.filter((c) => c.length > 0);
    if (nonEmpty.length < 2) continue;

    const dateCol = cells.find((c) => /^date$|^trans(action)?\s*date$|^posted$/i.test(c)) || "";
    const amountCol = cells.find((c) => /^amount$|^total$|^cost$|^price$|^spent$/i.test(c)) || "";

    if (dateCol && amountCol) {
      const locationCol =
        cells.find((c) => /^(purchase\s*)?location(\/store)?$|^store$|^merchant$|^payee$|^vendor$/i.test(c)) || "";
      const descCol =
        cells.find((c) => /^description$|^desc$|^item$|^memo$|^notes?$|^details?$/i.test(c)) || "";

      // Only include headers up to the main table (stop before empty gaps for side-tables)
      const mainHeaders: string[] = [];
      for (const cell of cells) {
        if (!cell) {
          if (mainHeaders.length >= 3) break;
          continue;
        }
        mainHeaders.push(cell);
      }

      return {
        headerRowIndex: r,
        headers: mainHeaders.length > 0 ? mainHeaders : nonEmpty,
        dateColumn: dateCol,
        payeeColumn: locationCol || descCol,
        memoColumn: locationCol && descCol ? descCol : "",
        amountColumn: amountCol,
      };
    }
  }

  return null;
}

function extractMonthlyProvision(rows: unknown[][], headerRowIndex: number): number | null {
  for (let r = 0; r < headerRowIndex; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? "").trim();
      if (/monthly\s*provision/i.test(cell)) {
        // Look ahead on the same row for the first valid number
        for (let k = c + 1; k < Math.min(row.length, c + 5); k++) {
          const val = parseCurrencyAmount(row[k]);
          if (Number.isFinite(val)) {
            return Math.round(val * 100) / 100;
          }
        }
      }
    }
  }
  return null;
}

export async function analyzeXlsx(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const existingCategoryNames = categories.map((c) => c.name);

  const suggestions: HistoricalMapping[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
    const detected = detectHeaderRow(rows);

    if (!detected) {
      suggestions.push({
        sheetName,
        isTransactionSheet: false,
        headerRowIndex: 0,
        headers: [],
        suggestedCategory: matchExistingCategory(sheetName, existingCategoryNames),
        dateColumn: "",
        payeeColumn: "",
        memoColumn: "",
        amountColumn: "",
        estimatedTransactionCount: 0,
        skippedBudgetRowCount: 0,
        detectedRollover: null,
        detectedMonthlyProvision: null,
      });
      continue;
    }

    const headerRow = (rows[detected.headerRowIndex] || []).map((c) => String(c ?? "").trim());
    const dateIdx = headerRow.indexOf(detected.dateColumn);
    const amountIdx = headerRow.indexOf(detected.amountColumn);
    const payeeIdx = headerRow.indexOf(detected.payeeColumn);
    const memoIdx = detected.memoColumn ? headerRow.indexOf(detected.memoColumn) : -1;

    let estimatedTransactionCount = 0;
    let skippedBudgetRowCount = 0;
    let detectedRollover: number | null = null;

    for (let r = detected.headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const parsedDate = parseExcelDate(row[dateIdx]);
      const parsedAmount = parseCurrencyAmount(row[amountIdx]);
      const descText = String((memoIdx >= 0 ? row[memoIdx] : row[payeeIdx]) ?? "").trim();

      if (!parsedDate || !Number.isFinite(parsedAmount)) continue;

      if (/^year\s*start$/i.test(descText)) {
        detectedRollover = Math.round(parsedAmount * 100) / 100;
        skippedBudgetRowCount++;
        continue;
      }

      if (isInternalBudgetRow(descText)) {
        skippedBudgetRowCount++;
        continue;
      }

      estimatedTransactionCount++;
    }

    const detectedMonthlyProvision = extractMonthlyProvision(rows, detected.headerRowIndex);
    const isSkipped = isSkippedSheetName(sheetName);
    const sheetRole = getLedgerSheetRole(sheetName);
    const suggestedCategory =
      sheetRole !== "category"
        ? getDefaultLedgerCategoryName(sheetRole)
        : matchExistingCategory(sheetName, existingCategoryNames);

    suggestions.push({
      sheetName,
      isTransactionSheet: !isSkipped && (estimatedTransactionCount > 0 || detectedRollover !== null),
      sheetRole,
      headerRowIndex: detected.headerRowIndex,
      headers: detected.headers,
      suggestedCategory,
      dateColumn: detected.dateColumn,
      payeeColumn: detected.payeeColumn,
      memoColumn: detected.memoColumn,
      amountColumn: detected.amountColumn,
      estimatedTransactionCount,
      skippedBudgetRowCount,
      detectedRollover,
      detectedMonthlyProvision,
    });
  }

  return {
    existingCategories: existingCategoryNames,
    suggestions,
  };
}

export async function executeHistoricalImport(
  buffer: Buffer,
  year: number,
  mappings: HistoricalMapping[],
  options: HistoricalImportOptions & { replaceExistingYear?: boolean } = {}
) {
  const isPastYear = year < new Date().getFullYear();
  const {
    skipBudgetRows = !isPastYear,
    applyRolloverAndBudget = true,
    archiveNewCategories = isPastYear,
    replaceExistingYear = false,
  } = options;
  const workbook = XLSX.read(buffer, { type: "buffer" });

  let budgetYear = await prisma.budgetYear.findUnique({ where: { year } });
  if (replaceExistingYear && isPastYear && budgetYear) {
    await deleteHistoricalYear(year, { cleanupEmptyArchivedCategories: false });
    budgetYear = null;
  }
  if (!budgetYear) {
    budgetYear = await prisma.budgetYear.create({ data: { year } });
  }

  const defaultAccount =
    (await prisma.account.findFirst({
      where: { name: "Historical Import Archive" },
    })) ||
    (await prisma.account.create({
      data: {
        name: "Historical Import Archive",
        remoteId: `hist-${year}`,
        excludeFromSurplus: true,
        showTransactions: true,
      },
    }));

  const results = {
    transactionsCreated: 0,
    transactionsSkippedDuplicate: 0,
    crossSheetDuplicatesSkipped: 0,
    budgetRowsSkipped: 0,
    categoriesCreated: 0,
    errors: [] as string[],
  };

  // Two-pass ordering: category sheets first (Pass 1), then income/debit/charge ledgers (Pass 2)
  const roleOrder: Record<SheetRole, number> = {
    category: 0,
    income: 1,
    debit: 2,
    charge: 3,
  };
  const orderedMappings = [...mappings].sort((a, b) => {
    const ra = a.sheetRole ?? getLedgerSheetRole(a.sheetName);
    const rb = b.sheetRole ?? getLedgerSheetRole(b.sheetName);
    return roleOrder[ra] - roleOrder[rb];
  });

  // Cross-sheet deduplication index: abs(amount).toFixed(2) -> [{ dateMs, consumed }]
  const importedTxIndex = new Map<string, { dateMs: number; consumed: boolean }[]>();
  const recordForDedup = (date: Date, amount: number) => {
    const key = Math.abs(amount).toFixed(2);
    const bucket = importedTxIndex.get(key) || [];
    bucket.push({ dateMs: date.getTime(), consumed: false });
    importedTxIndex.set(key, bucket);
  };

  for (const mapping of orderedMappings) {
    if (!mapping.isTransactionSheet) continue;
    const sheetRole = mapping.sheetRole ?? getLedgerSheetRole(mapping.sheetName);

    const sheet = workbook.Sheets[mapping.sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
    const headerRowIndex = mapping.headerRowIndex ?? 0;
    const headerRow = (rows[headerRowIndex] || []).map((c) => String(c ?? "").trim());

    const dateIdx = headerRow.indexOf(mapping.dateColumn);
    const amountIdx = headerRow.indexOf(mapping.amountColumn);
    const payeeIdx = headerRow.indexOf(mapping.payeeColumn);
    const memoIdx = mapping.memoColumn ? headerRow.indexOf(mapping.memoColumn) : -1;

    if (dateIdx < 0 || amountIdx < 0) {
      results.errors.push(`Sheet "${mapping.sheetName}": Could not locate Date or Amount column.`);
      continue;
    }

    const categoryName = mapping.suggestedCategory.trim() || mapping.sheetName.trim();
    let category = await prisma.category.findUnique({
      where: { name: categoryName },
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: categoryName,
          isArchived: archiveNewCategories,
        },
      });
      results.categoriesCreated++;
    }

    await prisma.yearlyCategory.upsert({
      where: {
        yearId_categoryId: {
          yearId: budgetYear.id,
          categoryId: category.id,
        },
      },
      update: applyRolloverAndBudget
        ? {
            ...(mapping.detectedMonthlyProvision !== null
              ? { monthlyBudget: { increment: mapping.detectedMonthlyProvision } }
              : {}),
            ...(mapping.detectedRollover !== null
              ? { rollover: { increment: mapping.detectedRollover } }
              : {}),
          }
        : {},
      create: {
        yearId: budgetYear.id,
        categoryId: category.id,
        monthlyBudget: applyRolloverAndBudget && mapping.detectedMonthlyProvision !== null ? mapping.detectedMonthlyProvision : 0,
        rollover: applyRolloverAndBudget && mapping.detectedRollover !== null ? mapping.detectedRollover : 0,
      },
    });

    for (let r = headerRowIndex + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      const date = parseExcelDate(row[dateIdx]);
      const amount = parseCurrencyAmount(row[amountIdx]);
      if (!date || !Number.isFinite(amount)) continue;

      const rawPayee = payeeIdx >= 0 ? String(row[payeeIdx] ?? "").trim() : "";
      const rawMemo = memoIdx >= 0 ? String(row[memoIdx] ?? "").trim() : "";
      const checkText = rawMemo || rawPayee;

      // Always skip Year Start rows when rollover is already applied to avoid double-counting
      if (applyRolloverAndBudget && /^year\s*start\b/i.test(checkText.trim())) {
        results.budgetRowsSkipped++;
        continue;
      }

      if (skipBudgetRows && isInternalBudgetRow(checkText)) {
        results.budgetRowsSkipped++;
        continue;
      }

      const payee = rawPayee || rawMemo || categoryName;
      const memo = rawMemo && rawMemo !== payee ? rawMemo : null;
      const rawRounded = Math.round(amount * 100) / 100;
      const roundedAmount = sheetRole === "income" ? Math.abs(rawRounded) : rawRounded;

      // Pass 2 deduplication: skip debit/charge rows already imported in Pass 1 (within ±2 days, same amount)
      if ((sheetRole === "debit" || sheetRole === "charge") && consumeCrossSheetMatch(importedTxIndex, date, roundedAmount, 2)) {
        results.crossSheetDuplicatesSkipped++;
        continue;
      }

      // Deterministic remoteId for duplicate protection across re-imports
      const hashInput = `${year}|${category.id}|${r}|${date.toISOString().slice(0, 10)}|${payee}|${memo || ""}|${roundedAmount.toFixed(2)}`;
      const remoteId = `hist-${createHash("sha256").update(hashInput).digest("hex").slice(0, 24)}`;

      const existing = await prisma.transaction.findUnique({
        where: { remoteId },
        select: { id: true },
      });

      if (existing) {
        results.transactionsSkippedDuplicate++;
        continue;
      }

      await prisma.transaction.create({
        data: {
          remoteId,
          date,
          payee,
          memo,
          amount: roundedAmount,
          accountId: defaultAccount.id,
          posted: true,
          splits: {
            create: {
              categoryId: category.id,
              amount: roundedAmount,
              memo,
            },
          },
        },
      });
      if (sheetRole === "category" || sheetRole === "debit") {
        recordForDedup(date, roundedAmount);
      }
      results.transactionsCreated++;
    }
  }

  logger.info("HistoricalImport", `Imported ${results.transactionsCreated} transactions for ${year}`, {
    action: "import.historical.complete",
    context: results,
  });

  return results;
}
