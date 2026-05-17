import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import fs from "fs";
import path from "path";
import { createBackupSnapshot } from "@/lib/services/backupService";

const BACKUP_DIR = "/app/backups";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        return NextResponse.json({ backups: [] });
      }

      const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith(".json"))
        .map(f => {
          const stats = fs.statSync(path.join(BACKUP_DIR, f));
          return {
            filename: f,
            size: stats.size,
            createdAt: stats.mtime,
          };
        })
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return NextResponse.json({ backups: files });
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const filename = await createBackupSnapshot("manual");
      if (!filename) throw new Error("Failed to create snapshot");
      return NextResponse.json({ success: true, filename });
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
