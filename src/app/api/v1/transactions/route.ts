import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getTransactions } from "@/lib/services/transactionService";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const { searchParams } = new URL(req.url);
    const take = parseInt(searchParams.get("take") || "1000");
    const skip = parseInt(searchParams.get("skip") || "0");
    const inboxOnly = searchParams.get("inboxOnly") === "true";
    const includeHidden = searchParams.get("includeHidden") === "true";
    const hiddenOnly = searchParams.get("hiddenOnly") === "true";

    const transactions = await getTransactions({ take, skip, inboxOnly, includeHidden, hiddenOnly });
    return NextResponse.json(transactions);
  });
}
