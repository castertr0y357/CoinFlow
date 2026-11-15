import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { startSyncSimpleFinTask } from "@/lib/services/syncService";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      let fullSync = false;
      try {
        const body = await req.json();
        fullSync = Boolean(body?.fullSync);
      } catch {
        // Empty body is valid for default incremental sync
      }

      const taskId = startSyncSimpleFinTask({ fullSync });
      return new NextResponse(JSON.stringify({ status: "accepted", task_id: taskId }), {
        status: 202,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
