import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { startSyncSimpleFinTask } from "@/lib/services/syncService";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  // This can be called via Cron job: curl -H "X-API-KEY: your-key" http://localhost:3000/api/v1/sync/background
  return withAuth(req, async () => {
    try {
      logger.info("BackgroundSync", "Background sync triggered...");
      const taskId = startSyncSimpleFinTask();
      logger.info("BackgroundSync", `Background sync task offloaded: ${taskId}`);
      return new NextResponse(JSON.stringify({ status: "accepted", task_id: taskId }), {
        status: 202,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      logger.error("BackgroundSync", "Background sync failed", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
