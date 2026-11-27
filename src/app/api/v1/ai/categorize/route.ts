import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getCategorySuggestions } from "@/lib/services/aiService";
import { getTransactions, getCategories } from "@/lib/services/transactionService";
import { buildPayeeCategoryMemory, lookupPayeeCategory } from "@/lib/normalizer";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const body = await req.json();
      const { transactionIds, deterministicOnly = false } = body;

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

      // 2. Tier 1: Deterministic Historical Payee -> Category Frequency & Commitment Lookup
      const [commitments, pastSplits] = await Promise.all([
        prisma.commitment.findMany({
          where: { categoryId: { not: null } },
          select: { name: true, categoryId: true },
        }),
        prisma.transactionSplit.findMany({
          where: { categoryId: { not: null }, category: { isArchived: false } },
          take: 1500,
          orderBy: { transaction: { date: 'desc' } },
          select: {
            categoryId: true,
            transaction: { select: { payee: true } },
            category: { select: { name: true } }
          }
        }),
      ]);

      const payeeMemory = buildPayeeCategoryMemory({
        commitments,
        historicalSplits: pastSplits
          .filter((s) => s.categoryId && s.transaction?.payee)
          .map((s) => ({
            payee: s.transaction.payee,
            categoryId: s.categoryId as string,
          })),
        minOccurrences: 1,
      });

      const mappedSuggestions: Record<string, string> = {};
      const unmatchedTransactions = [];

      for (const tx of targetTransactions) {
        const matchedCatId = lookupPayeeCategory(tx.payee, payeeMemory);
        if (matchedCatId) {
          mappedSuggestions[tx.id] = matchedCatId;
          continue;
        }
        unmatchedTransactions.push(tx);
      }

      // 3. Tier 2: On-Demand AI Fallback only for truly unknown merchants (skipped on auto-load)
      if (!deterministicOnly && unmatchedTransactions.length > 0) {
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
