import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getSplitSuggestions } from "@/lib/services/aiService";
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
          externalOrder: {
            include: { items: true }
          }
        }
      });

      if (!transaction || !transaction.externalOrder) {
        return NextResponse.json({ error: "Transaction not found or not linked to an order" }, { status: 404 });
      }

      const categories = await prisma.category.findMany();
      const items = transaction.externalOrder.items.map(item => ({
        title: item.title,
        price: Number(item.price)
      }));

      const suggestions = await getSplitSuggestions(transaction, items, categories);
      
      if (suggestions && Array.isArray(suggestions.splits)) {
        const nameToIdMap: Record<string, string> = {};
        categories.forEach(cat => {
          nameToIdMap[cat.name.toLowerCase().trim()] = cat.id;
        });

        const txIsNegative = Number(transaction.amount) < 0;

        const mappedSplits = suggestions.splits.map((s: any) => {
          const normalizedName = String(s.categoryName || "").toLowerCase().trim();
          const categoryId = nameToIdMap[normalizedName] || null;
          
          // Ensure correct sign for split amount
          const absPrice = Math.abs(Number(s.price || 0));
          const amount = txIsNegative ? -absPrice : absPrice;

          return {
            categoryId,
            amount,
            memo: s.title || null
          };
        });

        // Balance splits to equal transaction.amount exactly
        const txAmount = Number(transaction.amount);
        if (mappedSplits.length > 0) {
          const splitTotal = mappedSplits.reduce((acc: number, s: any) => acc + s.amount, 0);
          const diff = txAmount - splitTotal;
          if (Math.abs(diff) > 0.001) {
            mappedSplits[mappedSplits.length - 1].amount = Number((mappedSplits[mappedSplits.length - 1].amount + diff).toFixed(2));
          }
        } else {
          mappedSplits.push({
            categoryId: null,
            amount: txAmount,
            memo: "Uncategorized Remainder"
          });
        }

        return NextResponse.json({ splits: mappedSplits });
      }

      return NextResponse.json(suggestions);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
