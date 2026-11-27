import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getSplitSuggestions } from "@/lib/services/aiService";
import { suggestItemCategoryDeterministic } from "@/lib/normalizer";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const body = await req.json();
      const { transactionId } = body;

      if (!transactionId) {
        return NextResponse.json({ error: "Missing transactionId" }, { status: 400 });
      }

      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: { 
          splits: true,
          externalOrder: {
            include: { items: true }
          }
        }
      });

      if (!transaction || (!transaction.externalOrder && !transaction.matchedOrderId && transaction.splits.length <= 1)) {
        return NextResponse.json({ error: "Transaction not found or not linked to an order" }, { status: 404 });
      }

      const categories = await prisma.category.findMany({
        where: { isArchived: false },
      });
      let items: { title: string; price: number }[] = [];

      if (transaction.externalOrder && transaction.externalOrder.items.length > 0) {
        items = transaction.externalOrder.items.map(item => ({
          title: item.title,
          price: Number(item.price)
        }));
      } else {
        // Matched order was pruned; read items from transaction.splits memos and amounts
        items = transaction.splits
          .filter(s => !!s.memo)
          .map(s => ({
            title: s.memo || "Order Item",
            price: Math.abs(Number(s.amount))
          }));
      }

      if (items.length === 0) {
        return NextResponse.json({ error: "No order items found to suggest categories for" }, { status: 400 });
      }

      const [pastMemoSplits, settings] = await Promise.all([
        prisma.transactionSplit.findMany({
          where: {
            categoryId: { not: null },
            memo: { not: null },
          },
          select: {
            memo: true,
            category: { select: { name: true } },
          },
          take: 500,
        }),
        prisma.settings.findUnique({ where: { id: "global" } }),
      ]);

      const pastMemos = pastMemoSplits
        .filter((s) => s.memo && s.category?.name)
        .map((s) => ({ memo: s.memo as string, categoryName: s.category!.name }));

      const nameToIdMap: Record<string, string> = {};
      categories.forEach((cat) => {
        nameToIdMap[cat.name.toLowerCase().trim()] = cat.id;
      });

      const txIsNegative = Number(transaction.amount) < 0;
      const mappedSplits: Array<{ categoryId: string | null; amount: number; memo: string | null }> = [];
      const unmatchedItems: Array<{ index: number; title: string; price: number }> = [];

      items.forEach((item, idx) => {
        const detCatName = suggestItemCategoryDeterministic(item.title, categories, pastMemos);
        const absPrice = Math.abs(Number(item.price || 0));
        const amount = txIsNegative ? -absPrice : absPrice;

        if (detCatName) {
          const categoryId = nameToIdMap[detCatName.toLowerCase().trim()] || null;
          mappedSplits.push({ categoryId, amount, memo: item.title });
        } else {
          mappedSplits.push({ categoryId: null, amount, memo: item.title });
          unmatchedItems.push({ index: idx, title: item.title, price: item.price });
        }
      });

      // Only invoke AI for remaining unmatched items if AI is enabled
      if (unmatchedItems.length > 0 && settings?.aiEnabled) {
        const aiResult = await getSplitSuggestions(
          transaction,
          unmatchedItems.map((u) => ({ title: u.title, price: u.price })),
          categories
        );

        if (aiResult && Array.isArray(aiResult.splits)) {
          aiResult.splits.forEach((s: { categoryName: string | null; title?: string | null }, i: number) => {
            const target = unmatchedItems[i];
            if (!target) return;
            const normalizedName = String(s.categoryName || "").toLowerCase().trim();
            const categoryId = nameToIdMap[normalizedName] || null;
            if (categoryId) {
              mappedSplits[target.index].categoryId = categoryId;
            }
          });
        }
      }

      // Balance splits to equal transaction.amount exactly
      const txAmount = Number(transaction.amount);
      if (mappedSplits.length > 0) {
        const splitTotal = mappedSplits.reduce((acc, s) => acc + s.amount, 0);
        const diff = txAmount - splitTotal;
        if (Math.abs(diff) > 0.001) {
          mappedSplits[mappedSplits.length - 1].amount = Number(
            (mappedSplits[mappedSplits.length - 1].amount + diff).toFixed(2)
          );
        }
      } else {
        mappedSplits.push({
          categoryId: null,
          amount: txAmount,
          memo: "Uncategorized Remainder",
        });
      }

      return NextResponse.json({ splits: mappedSplits });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
