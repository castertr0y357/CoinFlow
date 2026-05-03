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
          amazonOrder: {
            include: { items: true }
          }
        }
      });

      if (!transaction || !transaction.amazonOrder) {
        return NextResponse.json({ error: "Transaction not found or not linked to Amazon" }, { status: 404 });
      }

      const categories = await prisma.category.findMany();
      const items = transaction.amazonOrder.items.map(item => ({
        title: item.title,
        price: Number(item.price)
      }));

      const suggestions = await getSplitSuggestions(transaction, items, categories);
      
      return NextResponse.json(suggestions);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
