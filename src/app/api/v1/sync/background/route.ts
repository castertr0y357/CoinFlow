import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { syncSimpleFin } from "@/lib/simplefin";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  // This can be called via Cron job: curl -H "X-API-KEY: your-key" http://localhost:3000/api/v1/sync/background
  return withAuth(req, async () => {
    try {
      logger.info("BackgroundSync", "Background sync started...");
      const result = await syncSimpleFin();
      logger.info("BackgroundSync", `Background sync completed: ${result.accountCount} accounts synced.`);
      return NextResponse.json(result);
    } catch (error) {
      logger.error("BackgroundSync", "Background sync failed", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
