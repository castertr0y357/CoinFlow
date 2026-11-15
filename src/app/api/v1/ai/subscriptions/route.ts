import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { detectSubscriptionsDeterministic } from "@/lib/normalizer";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      // Get the last 120 days of transactions for deterministic cadence analysis
      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - 120);

      const transactions = await prisma.transaction.findMany({
        where: {
          date: { gte: lookbackDate }
        },
        select: {
          id: true,
          date: true,
          payee: true,
          amount: true
        }
      });

      const subscriptions = detectSubscriptionsDeterministic(transactions);
      return NextResponse.json({ subscriptions });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
