import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { getSyncTaskStatus } from "@/lib/services/syncService";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const taskId = req.nextUrl.searchParams.get("taskId");
    if (!taskId) {
      return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
    }

    const task = getSyncTaskStatus(taskId);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  });
}
