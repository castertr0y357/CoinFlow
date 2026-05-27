import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { findRefundMatches } from "@/lib/services/transactionService";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const { searchParams } = new URL(req.url);
      const transactionId = searchParams.get("transactionId");
      
      if (!transactionId) {
        return NextResponse.json({ error: "Missing transactionId parameter" }, { status: 400 });
      }

      const matches = await findRefundMatches(transactionId);
      return NextResponse.json({ matches });
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
