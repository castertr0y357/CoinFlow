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
    const search = searchParams.get("q") || undefined;
    const yearParam = searchParams.get("year");
    const year = yearParam ? parseInt(yearParam, 10) : undefined;

    const transactions = await getTransactions({
      take,
      skip,
      inboxOnly,
      includeHidden,
      hiddenOnly,
      search,
      year: year && !isNaN(year) ? year : undefined,
    });
    return NextResponse.json(transactions);
  });
}
