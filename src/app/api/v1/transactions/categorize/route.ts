import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { categorizeSplit } from "@/lib/services/transactionService";
import { logger } from "@/lib/logger";

export async function PATCH(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const body = await req.json();
      const { splitId, categoryId } = body;

      if (!splitId) {
        return NextResponse.json({ error: "Missing splitId" }, { status: 400 });
      }

      logger.info("Transactions", `Categorizing split ${splitId} to category ${categoryId || "uncategorized"}`, {
        action: "transaction.categorize_split",
        context: { splitId, categoryId },
      });

      const updated = await categorizeSplit(splitId, categoryId);
      return NextResponse.json(updated);
    } catch (error) {
      logger.error("Transactions", "Failed to categorize transaction split", error, {
        action: "transaction.categorize_split",
      });
      return NextResponse.json({ error: "Failed to categorize split" }, { status: 500 });
    }
  });
}
