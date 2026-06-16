import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import fs from "fs";
import path from "path";

const BACKUP_DIR = "/app/backups";

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  return withAuth(req, async () => {
    try {
      const resolvedParams = await params;
      const { filename } = resolvedParams;
      
      if (!filename || (!filename.endsWith(".json.gz") && !filename.endsWith(".json"))) {
        return NextResponse.json({ error: "Invalid backup filename" }, { status: 400 });
      }

      // Prevent directory traversal
      const safeFilename = path.basename(filename);
      const filepath = path.join(BACKUP_DIR, safeFilename);
      
      if (!fs.existsSync(filepath)) {
        return NextResponse.json({ error: "Backup file not found" }, { status: 404 });
      }

      const fileBuffer = fs.readFileSync(filepath);
      const contentType = safeFilename.endsWith(".gz") ? "application/gzip" : "application/json";

      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${safeFilename}"`
        }
      });
    } catch (error) {
      console.error("Server Download error:", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
