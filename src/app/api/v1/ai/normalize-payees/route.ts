import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getCleanMerchantNamesBatch } from "@/lib/services/aiService";
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

      // 2. Identify the names we need to normalize. 
      // Use rawPayee if present, otherwise fall back to payee.
      const rawNamesToClean = transactions.map(tx => tx.rawPayee || tx.payee);

      // 3. Fetch past pattern examples to guide the LLM (where rawPayee is clean and different)
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

      // 4. Batch query the AI
      const cleanMap = await getCleanMerchantNamesBatch(rawNamesToClean, examples);

      // 5. Update each transaction in the database with the clean payee name
      let updatedCount = 0;
      for (const tx of transactions) {
        const raw = tx.rawPayee || tx.payee;
        const cleanName = cleanMap[raw];

        if (cleanName && cleanName.trim() !== "" && cleanName !== tx.payee) {
          await prisma.transaction.update({
            where: { id: tx.id },
            data: { payee: cleanName }
          });
          updatedCount++;
        }
      }

      return NextResponse.json({ success: true, count: updatedCount });
    } catch (error: any) {
      console.error("CoinFlow [AI Route]: Payee normalization failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
