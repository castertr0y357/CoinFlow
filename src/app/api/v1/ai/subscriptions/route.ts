import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { detectSubscriptions } from "@/lib/services/aiService";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      // Get the last 90 days of transactions for analysis
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const transactions = await prisma.transaction.findMany({
        where: {
          date: { gte: ninetyDaysAgo }
        }
      });

      const subscriptions = await detectSubscriptions(transactions);
      return NextResponse.json({ subscriptions });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
