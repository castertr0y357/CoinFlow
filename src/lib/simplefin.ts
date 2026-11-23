import prisma from "@/lib/prisma";
import { logger } from "./logger";
import { detectSourceFromPayee, matchTransactionToPendingOrder } from "./external-orders";
import { cleanMerchantNameDeterministic, buildPayeeCategoryMemory, lookupPayeeCategory } from "./normalizer";
import { recordMonthlyNetWorthSnapshot } from "./services/netWorthService";

interface SimpleFinTransaction {
  id: string;
  amount: string;
  description: string;
  posted: number;
  transacted_at?: number;
  transacted?: string;
  date?: string; 
}

export interface SimpleFinErrorItem {
  code?: string;
  msg?: string;
  conn_id?: string;
}

interface SimpleFinAccount {
  id: string;
  name: string;
  balance: string;
  currency: string;
  "balance-date"?: number;
  conn_id?: string;
  org?: {
    name?: string;
    domain?: string;
    id?: string;
  };
  transactions: SimpleFinTransaction[];
  err?: string;
  error?: string;
}

interface SimpleFinResponse {
  errors?: string[];
  errlist?: SimpleFinErrorItem[];
  accounts: SimpleFinAccount[];
}

/**
 * Matches SimpleFIN v2 `errlist[]` (via `conn_id`) or v1 `errors[]` messages
 * (via `org.name`, `org.domain`, `account.name`, or stale `balance-date`) to a specific account.
 */
export function matchSimpleFinAccountError(
  remoteAccount: SimpleFinAccount,
  topLevelErrors: string[] = [],
  errlist: SimpleFinErrorItem[] = []
): string | null {
  if (remoteAccount.err || remoteAccount.error) {
    return remoteAccount.err || remoteAccount.error || null;
  }

  // SimpleFIN v2: exact or suffix match by conn_id in errlist (accounts often prefix "MX-" to conn_id)
  if (remoteAccount.conn_id && errlist.length > 0) {
    const normAccConn = remoteAccount.conn_id.replace(/^MX-/i, "");
    const connMatches = errlist
      .filter((e) => {
        if (!e.conn_id) return false;
        const normErrConn = e.conn_id.replace(/^MX-/i, "");
        return e.conn_id === remoteAccount.conn_id || normErrConn === normAccConn;
      })
      .map((e) => e.msg || e.code)
      .filter((m): m is string => !!m);
    if (connMatches.length > 0) {
      return connMatches.join("; ");
    }
  }

  const unattributedMessages = [
    ...errlist.filter((e) => !e.conn_id).map((e) => e.msg || e.code).filter((m): m is string => !!m),
    ...(topLevelErrors || []),
  ];

  if (unattributedMessages.length === 0) return null;

  const candidates = [
    remoteAccount.org?.name,
    remoteAccount.org?.domain,
    remoteAccount.name,
  ]
    .filter((s): s is string => !!s && s.trim().length >= 3)
    .map((s) => s.toLowerCase().trim());

  const matched = unattributedMessages.filter((err) => {
    const lowerErr = err.toLowerCase();
    return candidates.some((c) => lowerErr.includes(c));
  });

  if (matched.length > 0) {
    return matched.join("; ");
  }

  // Fallback: if balance-date is > 3 days old and there are unattributed errors, flag as potentially stale
  const balanceDate = remoteAccount["balance-date"];
  if (balanceDate) {
    const ageDays = (Date.now() / 1000 - balanceDate) / 86400;
    if (ageDays > 3) {
      return unattributedMessages[0];
    }
  }

  return null;
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
    const topLevelErrors = Array.isArray(data.errors) ? data.errors : [];
    const errlist = Array.isArray(data.errlist) ? data.errlist : [];
    const allErrorMessages = [
      ...errlist.map((e) => e.msg || e.code).filter((m): m is string => !!m),
      ...topLevelErrors,
    ];
    if (allErrorMessages.length > 0) {
      logger.warn("SimpleFIN", `SimpleFIN returned ${allErrorMessages.length} connection error(s): ${allErrorMessages.join(" | ")}`);
    }
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
    const unmutedSyncErrors = new Set<string>();

    for (const remoteAccount of data.accounts) {
      const accountSyncError = matchSimpleFinAccountError(remoteAccount, topLevelErrors, errlist);
      const account = await prisma.account.upsert({
        where: { remoteId: remoteAccount.id },
        update: {
          name: remoteAccount.name,
          balance: remoteAccount.balance,
          currency: remoteAccount.currency,
          syncError: accountSyncError,
        },
        create: {
          remoteId: remoteAccount.id,
          name: remoteAccount.name,
          balance: remoteAccount.balance,
          currency: remoteAccount.currency,
          syncError: accountSyncError,
        },
      });
      if (account.muteSyncErrors && !accountSyncError) {
        await prisma.account.update({
          where: { id: account.id },
          data: { muteSyncErrors: false },
        });
        logger.info("SimpleFIN", `Account ${remoteAccount.name} recovered from sync error; alerts automatically unmuted.`);
      }
      if (accountSyncError && !account.muteSyncErrors) {
        unmutedSyncErrors.add(accountSyncError);
      }

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
        const autoCategoryId =
          lookupPayeeCategory(cleanName, payeeCategoryMemory) ||
          lookupPayeeCategory(remoteTx.description, payeeCategoryMemory);

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

    try {
      await recordMonthlyNetWorthSnapshot();
    } catch (snapErr) {
      logger.warn("SimpleFIN", "Failed to record monthly net worth snapshot", { error: snapErr });
    }

    return {
      success: true,
      accountCount: data.accounts.length,
      transactionCount: totalTransactions,
      newTransactionCount,
      syncErrors: Array.from(unmutedSyncErrors),
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const errorMsg = err instanceof Error ? (err.name === 'AbortError' ? 'Timeout' : err.message) : String(err);
    logger.error("SimpleFIN", `Sync process error: ${errorMsg}`);
    throw err;
  }
}
