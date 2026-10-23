import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { getStorageDriver } from "@/lib/services/storageDrivers";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const data = await req.json().catch(() => ({}));
      const settings = await prisma.settings.findUnique({ where: { id: "global" } });

      const testConfig = {
        backupStorageType: data.backupStorageType || settings?.backupStorageType || "LOCAL",
        backupLocalPath: data.backupLocalPath || settings?.backupLocalPath || "/app/backups",
        backupS3Endpoint: data.backupS3Endpoint ?? settings?.backupS3Endpoint,
        backupS3Bucket: data.backupS3Bucket ?? settings?.backupS3Bucket,
        backupS3Region: data.backupS3Region ?? settings?.backupS3Region,
        backupS3AccessKey: data.backupS3AccessKey ?? settings?.backupS3AccessKey,
        backupS3SecretKey: data.backupS3SecretKey ?? settings?.backupS3SecretKey,
        backupS3Prefix: data.backupS3Prefix ?? settings?.backupS3Prefix,
        backupCifsServer: data.backupCifsServer ?? settings?.backupCifsServer,
        backupCifsShare: data.backupCifsShare ?? settings?.backupCifsShare,
        backupCifsSubpath: data.backupCifsSubpath ?? settings?.backupCifsSubpath,
        backupCifsUsername: data.backupCifsUsername ?? settings?.backupCifsUsername,
        backupCifsPassword: data.backupCifsPassword ?? settings?.backupCifsPassword,
        backupCifsDomain: data.backupCifsDomain ?? settings?.backupCifsDomain,
        backupNfsServer: data.backupNfsServer ?? settings?.backupNfsServer,
        backupNfsExport: data.backupNfsExport ?? settings?.backupNfsExport,
        backupNfsSubpath: data.backupNfsSubpath ?? settings?.backupNfsSubpath,
      };

      const driver = getStorageDriver(testConfig);
      const result = await driver.testConnection();

      return NextResponse.json(result);
    } catch (error) {
      logger.error("BackupStorage", "Connection test failed", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ success: false, message }, { status: 500 });
    }
  });
}
