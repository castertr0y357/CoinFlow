import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { BACKUP_DIR } from "@/lib/services/backupService";
import { getStorageDriver } from "@/lib/services/storageDrivers";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  return withAuth(req, async () => {
    try {
      const resolvedParams = await params;
      const { filename } = resolvedParams;
      
      if (!filename) {
        return NextResponse.json({ error: "Invalid backup filename" }, { status: 400 });
      }

      const safeFilename = path.basename(filename);
      const settings = await prisma.settings.findUnique({ where: { id: "global" } });
      const driver = getStorageDriver({
        backupStorageType: settings?.backupStorageType,
        backupLocalPath: settings?.backupLocalPath,
      });

      let fileBuffer: Buffer;
      try {
        fileBuffer = await driver.retrieveFile(safeFilename);
      } catch (err) {
        const filepath = path.join(BACKUP_DIR, safeFilename);
        if (fs.existsSync(filepath)) {
          fileBuffer = fs.readFileSync(filepath);
        } else {
          return NextResponse.json({ error: "Backup file not found" }, { status: 404 });
        }
      }

      const contentType = safeFilename.endsWith(".enc") ? "application/octet-stream" : "application/gzip";

      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${safeFilename}"`
        }
      });
    } catch (error) {
      logger.error("Backup", "Server Download error", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  return withAuth(req, async () => {
    try {
      const resolvedParams = await params;
      const { filename } = resolvedParams;

      if (!filename) {
        return NextResponse.json({ error: "Invalid backup filename" }, { status: 400 });
      }

      const safeFilename = path.basename(filename);
      const settings = await prisma.settings.findUnique({ where: { id: "global" } });
      const driver = getStorageDriver({
        backupStorageType: settings?.backupStorageType,
        backupLocalPath: settings?.backupLocalPath,
      });

      try {
        await driver.deleteFile(safeFilename);
      } catch {}

      // Fallback local file deletion
      const filepath = path.join(BACKUP_DIR, safeFilename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }

      // Remove from catalog
      await prisma.backupRecord.deleteMany({ where: { filename: safeFilename } });

      logger.info("Backup", `Deleted backup snapshot: ${safeFilename}`);
      return NextResponse.json({ success: true, message: `Backup ${safeFilename} deleted.` });
    } catch (error) {
      logger.error("Backup", "Server Delete error", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
