import prisma from "@/lib/prisma";
import { logger } from "./logger";
import { detectSourceFromPayee, matchTransactionToPendingOrder } from "./external-orders";
import { cleanMerchantNameDeterministic, buildPayeeCategoryMemory } from "./normalizer";

interface SimpleFinTransaction {
  id: string;
  amount: string;
  description: string;
  posted: number;
  transacted_at?: number;
  transacted?: string;
  date?: string; 
}

interface SimpleFinAccount {
  id: string;
  name: string;
  balance: string;
  currency: string;
  transactions: SimpleFinTransaction[];
  err?: string;
  error?: string;
}

interface SimpleFinResponse {
  accounts: SimpleFinAccount[];
}

export interface SimpleFinSyncOptions {
  fullSync?: boolean;
}

export async function syncSimpleFin(options: SimpleFinSyncOptions = {}) {
  const { fullSync = false } = options;
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
  
  if (!settings?.simpleFinToken) {
    throw new Error("SimpleFIN token not configured");
  }

  logger.info("SimpleFIN", `Starting ${fullSync ? 'full-year' : 'incremental'} sync...`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

  try {
    let url = settings.simpleFinToken.trim();
    const headers: Record<string, string> = {};

    // Determine start-date: 14-day rolling lookback from lastSync, or Jan 1st for initial / fullSync
    const startOfYear = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);
    let startTimestamp = startOfYear;
    if (!fullSync && settings.lastSync) {
      const fourteenDaysAgo = Math.floor(settings.lastSync.getTime() / 1000) - 14 * 86400;
      startTimestamp = Math.max(startOfYear, fourteenDaysAgo);
    }

    // If the URL has credentials, extract them for Basic Auth
    if (url.includes('@')) {
      try {
        const urlObj = new URL(url);
        if (urlObj.username && urlObj.password) {
          const auth = Buffer.from(`${urlObj.username}:${urlObj.password}`).toString('base64');
          headers['Authorization'] = `Basic ${auth}`;
          urlObj.username = '';
          urlObj.password = '';
          url = urlObj.toString().replace(/\/$/, '');
        }
      } catch {
        logger.warn("SimpleFIN", "Failed to parse URL credentials, trying raw.");
      }
    }

    const baseUrl = url.replace(/\/$/, '');
    const accountsPath = baseUrl.includes('/accounts') ? baseUrl : `${baseUrl}/accounts`;
    const separator = accountsPath.includes('?') ? '&' : '?';
    const fetchUrl = `${accountsPath}${separator}version=2&start-date=${startTimestamp}`;

    logger.info("SimpleFIN", `Attempting fetch with start-date=${startTimestamp}`);

    const response = await fetch(fetchUrl, { 
      signal: controller.signal,
      headers
    });
    clearTimeout(timeoutId);
    
    logger.info("SimpleFIN", `Sync status: ${response.status}`);
 
    if (!response.ok) {
      const errText = await response.text();
      logger.error("SimpleFIN", `Sync failed with status ${response.status}: ${errText.substring(0, 500)}`);
      throw new Error(`SimpleFIN sync failed: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await response.text();
      logger.error("SimpleFIN", `Expected JSON but got ${contentType}: ${text.substring(0, 500)}`);
      throw new Error("SimpleFIN returned non-JSON response");
    }

    const data: SimpleFinResponse = await response.json();
    logger.info("SimpleFIN", `Found ${data.accounts.length} accounts.`);

    // 1. Collect all incoming remote transaction IDs across all accounts
    const allIncomingRemoteIds: string[] = [];
    let totalTransactions = 0;
    for (const remoteAccount of data.accounts) {
      totalTransactions += remoteAccount.transactions.length;
      for (const remoteTx of remoteAccount.transactions) {
        if (remoteTx.id) allIncomingRemoteIds.push(remoteTx.id);
      }
    }

    // 2. Single bulk query to identify already-imported transactions
    const existingRows = allIncomingRemoteIds.length > 0
      ? await prisma.transaction.findMany({
          where: { remoteId: { in: allIncomingRemoteIds } },
          select: { remoteId: true }
        })
      : [];
    const existingRemoteIds = new Set(existingRows.map(r => r.remoteId).filter(Boolean) as string[]);

    // 3. Collect unique rawPayees for genuinely new transactions and preload historical clean names
    const unseenDescriptions = new Set<string>();
    for (const remoteAccount of data.accounts) {
      for (const remoteTx of remoteAccount.transactions) {
        if (!existingRemoteIds.has(remoteTx.id) && remoteTx.description) {
          unseenDescriptions.add(remoteTx.description.trim());
        }
      }
    }

    const historyMap = new Map<string, string>();
    if (unseenDescriptions.size > 0) {
      const pastMatches = await prisma.transaction.findMany({
        where: {
          rawPayee: { in: Array.from(unseenDescriptions) }
        },
        select: { rawPayee: true, payee: true },
        orderBy: { createdAt: 'desc' }
      });
      for (const match of pastMatches) {
        if (match.rawPayee && !historyMap.has(match.rawPayee)) {
          historyMap.set(match.rawPayee, match.payee);
        }
      }
    }

    // Preload deterministic payee -> category memory from commitments & historical splits
    const [commitments, recentCategorizedSplits] = await Promise.all([
      prisma.commitment.findMany({
        where: { categoryId: { not: null } },
        select: { name: true, categoryId: true },
      }),
      prisma.transactionSplit.findMany({
        where: { categoryId: { not: null } },
        select: {
          categoryId: true,
          transaction: { select: { payee: true } },
        },
        orderBy: { transaction: { date: "desc" } },
        take: 1500,
      }),
    ]);

    const payeeCategoryMemory = buildPayeeCategoryMemory({
      commitments,
      historicalSplits: recentCategorizedSplits
        .filter((s) => s.categoryId && s.transaction?.payee)
        .map((s) => ({
          payee: s.transaction.payee,
          categoryId: s.categoryId as string,
        })),
    });

    let newTransactionCount = 0;

    for (const remoteAccount of data.accounts) {
      const account = await prisma.account.upsert({
        where: { remoteId: remoteAccount.id },
        update: {
          name: remoteAccount.name,
          balance: remoteAccount.balance,
          currency: remoteAccount.currency,
          syncError: remoteAccount.err || remoteAccount.error || null,
        },
        create: {
          remoteId: remoteAccount.id,
          name: remoteAccount.name,
          balance: remoteAccount.balance,
          currency: remoteAccount.currency,
          syncError: remoteAccount.err || remoteAccount.error || null,
        },
      });

      const newTransactions = remoteAccount.transactions.filter(tx => !existingRemoteIds.has(tx.id));
      logger.info("SimpleFIN", `Account ${remoteAccount.name}: ${newTransactions.length} new / ${remoteAccount.transactions.length} scanned.`);

      for (const remoteTx of newTransactions) {
        // Prioritize actual transaction date over posted date
        let txDate: Date;
        if (remoteTx.transacted_at) {
          txDate = new Date(remoteTx.transacted_at * 1000);
        } else if (remoteTx.transacted) {
          txDate = new Date(remoteTx.transacted);
        } else if (remoteTx.date) {
          txDate = new Date(remoteTx.date);
        } else {
          txDate = new Date(remoteTx.posted * 1000);
        }

        const cleanName = cleanMerchantNameDeterministic(remoteTx.description, historyMap);
        const autoCategoryId = payeeCategoryMemory.get(cleanName.toLowerCase().trim()) || null;

        const createdTx = await prisma.transaction.create({
          data: {
            remoteId: remoteTx.id,
            date: txDate,
            amount: remoteTx.amount,
            payee: cleanName,
            rawPayee: remoteTx.description,
            accountId: account.id,
            isHidden: account.excludeFromSurplus,
            splits: {
              create: {
                amount: remoteTx.amount,
                categoryId: autoCategoryId,
              }
            }
          },
        });
        newTransactionCount++;

        // Only check pending ExternalOrders for negative retail transactions
        if (Number(remoteTx.amount) < 0 && (detectSourceFromPayee(cleanName) || detectSourceFromPayee(remoteTx.description))) {
          try {
            await matchTransactionToPendingOrder(createdTx.id);
          } catch (matchErr) {
            logger.warn("SimpleFIN", `Order match check failed for transaction ${createdTx.id}`, { error: matchErr });
          }
        }
      }
    }

    await prisma.settings.update({
      where: { id: 'global' },
      data: { lastSync: new Date() },
    });

    return {
      success: true,
      accountCount: data.accounts.length,
      transactionCount: totalTransactions,
      newTransactionCount,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const errorMsg = err instanceof Error ? (err.name === 'AbortError' ? 'Timeout' : err.message) : String(err);
    logger.error("SimpleFIN", `Sync process error: ${errorMsg}`);
    throw err;
  }
}
