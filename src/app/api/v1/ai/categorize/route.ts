import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getCategorySuggestions } from "@/lib/services/aiService";
import { getTransactions, getCategories } from "@/lib/services/transactionService";
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

      // 1. Fetch data
      const allTransactions = await getTransactions();
      const targetTransactions = allTransactions.filter(tx => transactionIds.includes(tx.id));
      const categories = await getCategories();

      if (targetTransactions.length === 0) {
        return NextResponse.json({ suggestions: {} });
      }

      // 2. Tier 1: Deterministic Historical Payee -> Category Frequency Lookup
      const pastSplits = await prisma.transactionSplit.findMany({
        where: { categoryId: { not: null } },
        take: 500,
        orderBy: { updatedAt: 'desc' },
        select: {
          categoryId: true,
          transaction: { select: { payee: true } },
          category: { select: { name: true } }
        }
      });

      const payeeCategoryCounts = new Map<string, Map<string, number>>();
      for (const s of pastSplits) {
        if (!s.categoryId) continue;
        const normPayee = cleanMerchantNameDeterministic(s.transaction.payee).toLowerCase();
        if (!normPayee) continue;
        if (!payeeCategoryCounts.has(normPayee)) {
          payeeCategoryCounts.set(normPayee, new Map());
        }
        const counts = payeeCategoryCounts.get(normPayee)!;
        counts.set(s.categoryId, (counts.get(s.categoryId) || 0) + 1);
      }

      const mappedSuggestions: Record<string, string> = {};
      const unmatchedTransactions = [];

      for (const tx of targetTransactions) {
        const normPayee = cleanMerchantNameDeterministic(tx.payee).toLowerCase();
        const counts = payeeCategoryCounts.get(normPayee);
        if (counts && counts.size > 0) {
          let bestCategoryId = "";
          let bestCount = -1;
          for (const [catId, count] of counts.entries()) {
            if (count > bestCount) {
              bestCount = count;
              bestCategoryId = catId;
            }
          }
          if (bestCategoryId) {
            mappedSuggestions[tx.id] = bestCategoryId;
            continue;
          }
        }
        unmatchedTransactions.push(tx);
      }

      // 3. Tier 2: On-Demand AI Fallback only for truly unknown merchants
      if (unmatchedTransactions.length > 0) {
        const settings = await prisma.settings.findUnique({ where: { id: "global" }, select: { aiEnabled: true } });
        if (settings?.aiEnabled) {
          const examples = pastSplits.slice(0, 20).map(s => ({
            payee: s.transaction.payee,
            categoryName: s.category?.name || "Unknown"
          }));

          const aiSuggestions = await getCategorySuggestions(unmatchedTransactions, categories, examples);
          const nameToIdMap: Record<string, string> = {};
          categories.forEach(cat => {
            nameToIdMap[cat.name.toLowerCase().trim()] = cat.id;
          });

          for (const [txId, catName] of Object.entries(aiSuggestions)) {
            const normalizedName = String(catName).toLowerCase().trim();
            const categoryId = nameToIdMap[normalizedName];
            if (categoryId) {
              mappedSuggestions[txId] = categoryId;
            }
          }
        }
      }

      return NextResponse.json({ suggestions: mappedSuggestions });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
