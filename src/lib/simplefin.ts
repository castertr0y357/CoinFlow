import prisma from "@/lib/prisma";
import { getCleanMerchantName } from "./services/aiService";
import { logger } from "./logger";

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
}

interface SimpleFinResponse {
  accounts: SimpleFinAccount[];
}

export async function syncSimpleFin() {
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
  
  if (!settings?.simpleFinToken) {
    throw new Error("SimpleFIN token not configured");
  }

  logger.info("SimpleFIN", "Starting sync...");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

  try {
    let url = settings.simpleFinToken;
    const headers: Record<string, string> = {};

    // If the URL has credentials, extract them for Basic Auth
    if (url.includes('@')) {
      try {
        const urlObj = new URL(url);
        if (urlObj.username && urlObj.password) {
          const auth = Buffer.from(`${urlObj.username}:${urlObj.password}`).toString('base64');
          headers['Authorization'] = `Basic ${auth}`;
          // Strip credentials from URL
          urlObj.username = '';
          urlObj.password = '';
          
          // Request data from the start of the current year
          const startOfYear = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);
          url = urlObj.toString().replace(/\/$/, '') + `/accounts?version=2&start-date=${startOfYear}`;
        }
      } catch {
        logger.warn("SimpleFIN", "Failed to parse URL credentials, trying raw.");
      }
    }

    logger.info("SimpleFIN", `Attempting fetch from: ${url}`);
    const startOfYear = Math.floor(new Date(new Date().getFullYear(), 0, 1).getTime() / 1000);
    const fetchUrl = url.includes('?') 
      ? `${url}&start-date=${startOfYear}` 
      : `${url}${url.includes('/accounts') ? '' : '/accounts'}?version=2&start-date=${startOfYear}`;

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

    for (const remoteAccount of data.accounts) {
      const account = await prisma.account.upsert({
        where: { remoteId: remoteAccount.id },
        update: {
          name: remoteAccount.name,
          balance: remoteAccount.balance,
          currency: remoteAccount.currency,
        },
        create: {
          remoteId: remoteAccount.id,
          name: remoteAccount.name,
          balance: remoteAccount.balance,
          currency: remoteAccount.currency,
        },
      });

      logger.info("SimpleFIN", `Processing account ${remoteAccount.name} with ${remoteAccount.transactions.length} transactions. (First TX Date: ${remoteAccount.transactions[0]?.date || remoteAccount.transactions[0]?.posted})`);

      for (const remoteTx of remoteAccount.transactions) {
        const existing = await prisma.transaction.findUnique({
          where: { remoteId: remoteTx.id }
        });

        if (!existing) {
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

          const previousMatch = await prisma.transaction.findFirst({
            where: { rawPayee: remoteTx.description },
            select: { payee: true }
          });

          let cleanName = remoteTx.description;
          if (previousMatch) {
            cleanName = previousMatch.payee;
          } else {
            const recentExamples = await prisma.transaction.findMany({
              where: { rawPayee: { not: null } },
              take: 5,
              orderBy: { createdAt: 'desc' },
              select: { rawPayee: true, payee: true }
            });
            
            cleanName = await getCleanMerchantName(
              remoteTx.description, 
              recentExamples.map(e => ({ raw: e.rawPayee!, clean: e.payee }))
            );
          }

          await prisma.transaction.create({
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
                }
              }
            },
          });
        }
      }
    }

    await prisma.settings.update({
      where: { id: 'global' },
      data: { lastSync: new Date() },
    });

    return { success: true, accountCount: data.accounts.length };
  } catch (err) {
    clearTimeout(timeoutId);
    const errorMsg = err instanceof Error ? (err.name === 'AbortError' ? 'Timeout' : err.message) : String(err);
    logger.error("SimpleFIN", `Sync process error: ${errorMsg}`);
    throw err;
  }
}
