import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getCategorySuggestions } from "@/lib/services/aiService";
import { getTransactions, getCategories } from "@/lib/services/transactionService";
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

      // 2. Fetch Pattern Memory (Examples)
      // Grab the last 30 categorized splits to train the AI on user's style
      const pastSplits = await prisma.transactionSplit.findMany({
        where: { categoryId: { not: null } },
        take: 30,
        orderBy: { updatedAt: 'desc' },
        include: { 
          transaction: { select: { payee: true } },
          category: { select: { name: true } }
        }
      });

      const examples = pastSplits.map(s => ({
        payee: s.transaction.payee,
        categoryName: s.category?.name || "Unknown"
      }));

      // 3. Get suggestions with memory
      const suggestions = await getCategorySuggestions(targetTransactions, categories, examples);
      
      return NextResponse.json({ suggestions });
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
