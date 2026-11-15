import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getCleanMerchantNamesBatch } from "@/lib/services/aiService";
import { cleanMerchantNameDeterministic } from "@/lib/normalizer";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const body = await req.json();
      const { transactionIds } = body;

      if (!transactionIds || !Array.isArray(transactionIds)) {
        return NextResponse.json({ error: "Missing transactionIds array" }, { status: 400 });
      }

      if (transactionIds.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }

      // 1. Fetch the target transactions from the database
      const transactions = await prisma.transaction.findMany({
        where: { id: { in: transactionIds } },
        select: { id: true, payee: true, rawPayee: true }
      });

      if (transactions.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }

      // 2. Apply fast deterministic cleaning first, collect remaining ambiguous names for AI
      const deterministicMap = new Map<string, string>();
      const remainingForAi = new Set<string>();

      for (const tx of transactions) {
        const raw = tx.rawPayee || tx.payee;
        const detClean = cleanMerchantNameDeterministic(raw);
        if (detClean && detClean !== raw && detClean !== tx.payee) {
          deterministicMap.set(raw, detClean);
        } else {
          remainingForAi.add(raw);
        }
      }

      let aiCleanMap: Record<string, string> = {};
      if (remainingForAi.size > 0) {
        const settings = await prisma.settings.findUnique({ where: { id: "global" }, select: { aiEnabled: true } });
        if (settings?.aiEnabled) {
          const pastTransactions = await prisma.transaction.findMany({
            where: {
              rawPayee: { not: null },
              payee: { not: "" }
            },
            take: 10,
            orderBy: { createdAt: "desc" },
            select: { payee: true, rawPayee: true }
          });

          const examples = pastTransactions
            .filter(tx => tx.rawPayee !== tx.payee)
            .map(tx => ({
              raw: tx.rawPayee!,
              clean: tx.payee
            }));

          aiCleanMap = await getCleanMerchantNamesBatch(Array.from(remainingForAi), examples);
        }
      }

      // 3. Batch update all changed transactions in a single Prisma transaction
      const updates = [];
      for (const tx of transactions) {
        const raw = tx.rawPayee || tx.payee;
        const cleanName = deterministicMap.get(raw) || aiCleanMap[raw];

        if (cleanName && cleanName.trim() !== "" && cleanName !== tx.payee) {
          updates.push(
            prisma.transaction.update({
              where: { id: tx.id },
              data: { payee: cleanName }
            })
          );
        }
      }

      if (updates.length > 0) {
        await prisma.$transaction(updates);
      }

      return NextResponse.json({ success: true, count: updates.length });
    } catch (error) {
      console.error("CoinFlow [AI Route]: Payee normalization failed:", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
