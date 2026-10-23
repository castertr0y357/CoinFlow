import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";
import { createBackupSnapshot, restoreDatabaseFromBuffer, BACKUP_DIR } from "@/lib/services/backupService";
import { getStorageDriver } from "@/lib/services/storageDrivers";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const { filename, passphrase } = await req.json();

      if (!filename || typeof filename !== "string") {
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
        // Fallback to local disk if driver fails
        const filepath = path.join(BACKUP_DIR, safeFilename);
        if (fs.existsSync(filepath)) {
          fileBuffer = fs.readFileSync(filepath);
        } else {
          return NextResponse.json({ error: "Backup file not found in storage." }, { status: 404 });
        }
      }

      // 0. Take a safety snapshot before we overwrite anything
      await createBackupSnapshot("pre-restore");

      const effectivePassphrase = passphrase || settings?.backupEncryptionPass || null;
      await restoreDatabaseFromBuffer(fileBuffer, safeFilename, effectivePassphrase);

      return NextResponse.json({ success: true, message: `Database successfully restored from snapshot '${safeFilename}'.` });
    } catch (error) {
      logger.error("Backup", "Server Restore error", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
