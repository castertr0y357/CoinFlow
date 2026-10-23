import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { getStorageDriver } from "@/lib/services/storageDrivers";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const settings = await prisma.settings.findUnique({ where: { id: "global" } });
      const config = {
        backupEnabled: settings?.backupEnabled ?? false,
        backupTime: settings?.backupTime ?? "02:00",
        backupWeeklyDay: settings?.backupWeeklyDay ?? 0,
        backupMonthlyDay: settings?.backupMonthlyDay ?? 1,
        backupKeepDaily: settings?.backupKeepDaily ?? 7,
        backupKeepWeekly: settings?.backupKeepWeekly ?? 4,
        backupKeepMonthly: settings?.backupKeepMonthly ?? 3,
        backupPreserveConfig: settings?.backupPreserveConfig ?? true,
        backupStorageType: settings?.backupStorageType ?? "LOCAL",
        backupLocalPath: settings?.backupLocalPath ?? "/app/backups",
        backupS3Endpoint: settings?.backupS3Endpoint ?? "",
        backupS3Bucket: settings?.backupS3Bucket ?? "",
        backupS3Region: settings?.backupS3Region ?? "us-east-1",
        backupS3AccessKey: settings?.backupS3AccessKey ?? "",
        backupS3Prefix: settings?.backupS3Prefix ?? "coinflow/",
        backupCifsServer: settings?.backupCifsServer ?? "",
        backupCifsShare: settings?.backupCifsShare ?? "",
        backupCifsSubpath: settings?.backupCifsSubpath ?? "",
        backupCifsUsername: settings?.backupCifsUsername ?? "",
        backupCifsDomain: settings?.backupCifsDomain ?? "",
        backupNfsServer: settings?.backupNfsServer ?? "",
        backupNfsExport: settings?.backupNfsExport ?? "",
        backupNfsSubpath: settings?.backupNfsSubpath ?? "",
        hasEncryptionPass: Boolean(settings?.backupEncryptionPass && settings.backupEncryptionPass.trim() !== ""),
        backupWebhookUrl: settings?.backupWebhookUrl ?? "",
        backupLastRunAt: settings?.backupLastRunAt ?? null,
        backupLastStatus: settings?.backupLastStatus ?? "",
        backupLastError: settings?.backupLastError ?? "",
      };

      return NextResponse.json({ config });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const data = await req.json();

      const updateData: Record<string, any> = {
        backupEnabled: Boolean(data.backupEnabled),
        backupTime: typeof data.backupTime === "string" ? data.backupTime.trim() : "02:00",
        backupWeeklyDay: Number(data.backupWeeklyDay ?? 0),
        backupMonthlyDay: Math.max(1, Math.min(28, Number(data.backupMonthlyDay ?? 1))),
        backupKeepDaily: Math.max(0, Number(data.backupKeepDaily ?? 7)),
        backupKeepWeekly: Math.max(0, Number(data.backupKeepWeekly ?? 4)),
        backupKeepMonthly: Math.max(0, Number(data.backupKeepMonthly ?? 3)),
        backupPreserveConfig: Boolean(data.backupPreserveConfig ?? true),
        backupStorageType: typeof data.backupStorageType === "string" ? data.backupStorageType : "LOCAL",
        backupLocalPath: typeof data.backupLocalPath === "string" && data.backupLocalPath.trim() ? data.backupLocalPath.trim() : "/app/backups",
        backupS3Endpoint: data.backupS3Endpoint ? String(data.backupS3Endpoint).trim() : null,
        backupS3Bucket: data.backupS3Bucket ? String(data.backupS3Bucket).trim() : null,
        backupS3Region: data.backupS3Region ? String(data.backupS3Region).trim() : "us-east-1",
        backupS3Prefix: data.backupS3Prefix ? String(data.backupS3Prefix).trim() : "coinflow/",
        backupCifsServer: data.backupCifsServer ? String(data.backupCifsServer).trim() : null,
        backupCifsShare: data.backupCifsShare ? String(data.backupCifsShare).trim() : null,
        backupCifsSubpath: data.backupCifsSubpath ? String(data.backupCifsSubpath).trim() : null,
        backupCifsUsername: data.backupCifsUsername ? String(data.backupCifsUsername).trim() : null,
        backupCifsDomain: data.backupCifsDomain ? String(data.backupCifsDomain).trim() : null,
        backupNfsServer: data.backupNfsServer ? String(data.backupNfsServer).trim() : null,
        backupNfsExport: data.backupNfsExport ? String(data.backupNfsExport).trim() : null,
        backupNfsSubpath: data.backupNfsSubpath ? String(data.backupNfsSubpath).trim() : null,
        backupWebhookUrl: data.backupWebhookUrl ? String(data.backupWebhookUrl).trim() : null,
      };

      if (typeof data.backupS3AccessKey === "string" && data.backupS3AccessKey !== "") {
        updateData.backupS3AccessKey = data.backupS3AccessKey.trim();
      }
      if (typeof data.backupS3SecretKey === "string" && data.backupS3SecretKey !== "") {
        updateData.backupS3SecretKey = data.backupS3SecretKey.trim();
      }
      if (typeof data.backupCifsPassword === "string" && data.backupCifsPassword !== "") {
        updateData.backupCifsPassword = data.backupCifsPassword.trim();
      }
      if (typeof data.backupEncryptionPass === "string") {
        updateData.backupEncryptionPass = data.backupEncryptionPass.trim() || null;
      }

      await prisma.settings.upsert({
        where: { id: "global" },
        update: updateData,
        create: {
          id: "global",
          ...updateData,
        }
      });

      logger.info("BackupConfig", "Updated automated GFS backup schedule & storage settings");
      return NextResponse.json({ success: true, message: "Backup configuration saved successfully." });
    } catch (error) {
      logger.error("BackupConfig", "Failed to save backup configuration", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
