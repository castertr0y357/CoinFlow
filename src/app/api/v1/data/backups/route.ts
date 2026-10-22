import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import fs from "fs";
import path from "path";
import { createBackupSnapshot } from "@/lib/services/backupService";
import { logger } from "@/lib/logger";

const BACKUP_DIR = "/app/backups";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        return NextResponse.json({ backups: [] });
      }

      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith(".sql.gz"))
        .map(f => {
          const stats = fs.statSync(path.join(BACKUP_DIR, f));
          return {
            filename: f,
            size: stats.size,
            createdAt: stats.mtime,
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      logger.debug("Backup", `Listed ${files.length} database backups`, {
        action: "backup.list",
        context: { count: files.length },
      });

      return NextResponse.json({ backups: files });
    } catch (error) {
      logger.error("Backup", "Failed to list backups", error, { action: "backup.list" });
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      logger.info("Backup", "Manual database backup requested", { action: "backup.create_manual" });
      const filename = await createBackupSnapshot("manual");
      if (!filename) throw new Error("Failed to create snapshot");
      logger.info("Backup", `Manual database backup succeeded: ${filename}`, {
        action: "backup.create_manual",
        context: { filename },
      });
      return NextResponse.json({ success: true, filename });
    } catch (error) {
      logger.error("Backup", "Manual database backup failed", error, { action: "backup.create_manual" });
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
