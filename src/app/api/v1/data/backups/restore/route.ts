import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import fs from "fs";
import path from "path";
import { createBackupSnapshot, restoreDatabaseFromBuffer } from "@/lib/services/backupService";
import { logger } from "@/lib/logger";

const BACKUP_DIR = "/app/backups";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const { filename } = await req.json();

      if (!filename || typeof filename !== "string" || !filename.endsWith(".sql.gz")) {
        return NextResponse.json({ error: "Invalid backup filename" }, { status: 400 });
      }

      const safeFilename = path.basename(filename);
      const filepath = path.join(BACKUP_DIR, safeFilename);
      if (!fs.existsSync(filepath)) {
        return NextResponse.json({ error: "Backup file not found" }, { status: 404 });
      }

      // 0. Take a safety snapshot before we overwrite anything
      await createBackupSnapshot("pre-restore");

      const fileBuffer = fs.readFileSync(filepath);
      await restoreDatabaseFromBuffer(fileBuffer, safeFilename);

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error("Backup", "Server Restore error", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
