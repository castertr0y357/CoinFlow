import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { createBackupSnapshot, restoreDatabaseFromBuffer } from "@/lib/services/backupService";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const contentType = req.headers.get("content-type") || "";
      let fileBuffer: Buffer;
      let filename = "upload.sql.gz";

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("file");
        if (!file || !(file instanceof Blob)) {
          return NextResponse.json({ error: "No backup file provided" }, { status: 400 });
        }
        if ("name" in file && typeof file.name === "string") {
          filename = file.name;
        }
        if (!filename.endsWith(".sql.gz") && !filename.endsWith(".sql")) {
          return NextResponse.json({ error: "Invalid backup file format. Expected .sql.gz or .sql" }, { status: 400 });
        }
        const arrayBuffer = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      } else {
        const arrayBuffer = await req.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
      }

      if (fileBuffer.length === 0) {
        return NextResponse.json({ error: "Empty backup payload" }, { status: 400 });
      }

      // 0. Take a safety snapshot before we do anything
      await createBackupSnapshot("pre-import");

      await restoreDatabaseFromBuffer(fileBuffer, filename);

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error("Backup", "Import error", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
