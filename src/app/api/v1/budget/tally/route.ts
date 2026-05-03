import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getMonthlyTally } from "@/lib/services/budgetService";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year");
    const tally = await getMonthlyTally(year ? parseInt(year) : undefined);
    return NextResponse.json(tally);
  });
}
