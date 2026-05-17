import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import fs from "fs";
import path from "path";
import { createBackupSnapshot, restoreBackupData } from "@/lib/services/backupService";

const BACKUP_DIR = "/app/backups";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const { filename } = await req.json();

      if (!filename || !filename.endsWith(".json")) {
        return NextResponse.json({ error: "Invalid backup filename" }, { status: 400 });
      }

      const filepath = path.join(BACKUP_DIR, filename);
      if (!fs.existsSync(filepath)) {
        return NextResponse.json({ error: "Backup file not found" }, { status: 404 });
      }

      // 0. Take a safety snapshot before we overwrite anything
      await createBackupSnapshot("pre-restore");

      const text = fs.readFileSync(filepath, "utf-8");
      const backup = JSON.parse(text);

      const isLegacy = backup.version === "1.0";
      if (!backup.data || (!isLegacy && backup.version !== "1.1")) {
        return NextResponse.json({ error: "Invalid backup format" }, { status: 400 });
      }

      await restoreBackupData(backup.data);

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error("Server Restore error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
