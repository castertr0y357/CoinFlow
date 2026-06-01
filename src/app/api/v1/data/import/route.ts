import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { createBackupSnapshot, restoreBackupData } from "@/lib/services/backupService";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      // 0. Take a safety snapshot before we do anything
      await createBackupSnapshot("pre-import");

      const backup = await req.json();
      
      const isLegacy = backup.version === "1.0";
      if (!backup.data || (!isLegacy && backup.version !== "1.1")) {
        return NextResponse.json({ error: "Invalid backup format" }, { status: 400 });
      }

      await restoreBackupData(backup.data);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Import error:", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
