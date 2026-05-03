import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { syncSimpleFin } from "@/lib/simplefin";

export async function GET(req: NextRequest) {
  // This can be called via Cron job: curl -H "X-API-KEY: your-key" http://localhost:3000/api/v1/sync/background
  return withAuth(req, async () => {
    try {
      console.log("Background sync started...");
      const result = await syncSimpleFin();
      console.log(`Background sync completed: ${result.accountCount} accounts synced.`);
      return NextResponse.json(result);
    } catch (error: any) {
      console.error("Background sync failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
