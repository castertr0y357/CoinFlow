import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getSyncTaskStatus } from "@/lib/services/syncService";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(req, async () => {
    try {
      const resolvedParams = await params;
      const { id } = resolvedParams;
      const task = getSyncTaskStatus(id);

      if (!task) {
        return NextResponse.json({ error: "Task not found" }, { status: 404 });
      }

      return NextResponse.json(task);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
