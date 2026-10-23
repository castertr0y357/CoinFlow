import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { spawn } from "child_process";
import { logger } from "../logger";
import { getStorageDriver } from "./storageDrivers";
import { encryptPayload, decryptPayload, ENCRYPTION_MAGIC } from "./backupCrypto";
import { isSafeUrl } from "../security";

export const BACKUP_DIR = "/app/backups";

export function determineGfsTier(date: Date, config: { backupWeeklyDay: number; backupMonthlyDay: number }): "DAILY" | "WEEKLY" | "MONTHLY" {
  // Weekly day in JS: getDay() 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  if (date.getDate() === config.backupMonthlyDay) {
    return "MONTHLY";
  }
  if (date.getDay() === config.backupWeeklyDay) {
    return "WEEKLY";
  }
  return "DAILY";
}

export async function dispatchWebhookFailure(webhookUrl: string, errorMsg: string, tier: string = "SCHEDULED"): Promise<void> {
  if (!webhookUrl || webhookUrl.trim() === "") return;

  const trimmed = webhookUrl.trim();
  const safe = await isSafeUrl(trimmed);
  if (!safe) {
    logger.warn("BackupEngine", `Blocked webhook dispatch to unsafe URL: ${trimmed}`);
    return;
  }

  const payload = {
    content: `🚨 **CoinFlow Backup Failure**: Scheduled \`${tier}\` backup failed: ${errorMsg}`,
    text: `🚨 CoinFlow Backup Failure: ${errorMsg}`,
    title: "CoinFlow Backup Alert",
    message: errorMsg,
    timestamp: new Date().toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    await fetch(trimmed, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (exc) {
    logger.error("BackupEngine", "Webhook notification failed", exc);
  }
}

export function dumpDatabaseSqlGz(): Promise<Buffer> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return Promise.reject(new Error("DATABASE_URL environment variable is not configured"));
  }

  return new Promise((resolve, reject) => {
    const proc = spawn("pg_dump", [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-privileges",
      "--dbname",
      dbUrl
    ]);

    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) {
        try {
          const rawSql = Buffer.concat(chunks).toString("utf-8");
          // Strip SET transaction_timeout (added in PG 17+ pg_dump) for compatibility with PG 15/16 servers
          const compatibleSql = rawSql.replace(/^[ \t]*(?:SET\s+transaction_timeout|SELECT\s+pg_catalog\.set_config\(\s*['"]transaction_timeout).*;\r?\n?/gim, "");
          const compressed = zlib.gzipSync(Buffer.from(compatibleSql, "utf-8"));
          resolve(compressed);
        } catch (err) {
          reject(err);
        }
      } else {
        const stderr = Buffer.concat(errChunks).toString("utf-8").trim();
        reject(new Error(`pg_dump exited with code ${code}: ${stderr}`));
      }
    });
  });
}

export function restoreDatabaseSql(sqlContent: string | Buffer): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return Promise.reject(new Error("DATABASE_URL environment variable is not configured"));
  }

  return new Promise((resolve, reject) => {
    const proc = spawn("psql", [
      "-v",
      "ON_ERROR_STOP=1",
      "--dbname",
      dbUrl
    ]);

    const errChunks: Buffer[] = [];

    proc.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        const stderr = Buffer.concat(errChunks).toString("utf-8").trim();
        reject(new Error(`psql exited with code ${code}: ${stderr}`));
      }
    });

    proc.stdin.on("error", () => {
      // Ignore EPIPE on stdin if psql terminates early; close event will capture stderr and exit code
    });
    const sqlStr = Buffer.isBuffer(sqlContent) ? sqlContent.toString("utf-8") : sqlContent;
    const compatibleSql = sqlStr.replace(/^[ \t]*(?:SET\s+transaction_timeout|SELECT\s+pg_catalog\.set_config\(\s*['"]transaction_timeout).*;\r?\n?/gim, "");
    proc.stdin.write(compatibleSql);
    proc.stdin.end();
  });
}

export async function restoreDatabaseFromBuffer(fileBuffer: Buffer, filename: string, passphrase?: string | null): Promise<void> {
  // Check if encrypted
  let decrypted = fileBuffer;
  if (filename.endsWith(".enc") || (fileBuffer.length >= 8 && fileBuffer.subarray(0, 8).equals(ENCRYPTION_MAGIC))) {
    decrypted = decryptPayload(fileBuffer, passphrase);
  }

  let sqlBuffer: Buffer;
  const isGzip = filename.endsWith(".gz") || (decrypted.length >= 2 && decrypted[0] === 0x1f && decrypted[1] === 0x8b);
  if (isGzip) {
    sqlBuffer = zlib.gunzipSync(decrypted);
  } else {
    sqlBuffer = decrypted;
  }

  // Check if config preservation is enabled
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const preserve = settings?.backupPreserveConfig ?? true;
  const originalSettings = preserve ? settings : null;

  await restoreDatabaseSql(sqlBuffer);

  // Restore preserved backup configuration if requested
  if (originalSettings) {
    try {
      await prisma.settings.upsert({
        where: { id: "global" },
        update: {
          backupEnabled: originalSettings.backupEnabled,
          backupTime: originalSettings.backupTime,
          backupWeeklyDay: originalSettings.backupWeeklyDay,
          backupMonthlyDay: originalSettings.backupMonthlyDay,
          backupKeepDaily: originalSettings.backupKeepDaily,
          backupKeepWeekly: originalSettings.backupKeepWeekly,
          backupKeepMonthly: originalSettings.backupKeepMonthly,
          backupPreserveConfig: originalSettings.backupPreserveConfig,
          backupStorageType: originalSettings.backupStorageType,
          backupLocalPath: originalSettings.backupLocalPath,
          backupS3Endpoint: originalSettings.backupS3Endpoint,
          backupS3Bucket: originalSettings.backupS3Bucket,
          backupS3Region: originalSettings.backupS3Region,
          backupS3AccessKey: originalSettings.backupS3AccessKey,
          backupS3SecretKey: originalSettings.backupS3SecretKey,
          backupS3Prefix: originalSettings.backupS3Prefix,
          backupCifsServer: originalSettings.backupCifsServer,
          backupCifsShare: originalSettings.backupCifsShare,
          backupCifsSubpath: originalSettings.backupCifsSubpath,
          backupCifsUsername: originalSettings.backupCifsUsername,
          backupCifsPassword: originalSettings.backupCifsPassword,
          backupCifsDomain: originalSettings.backupCifsDomain,
          backupNfsServer: originalSettings.backupNfsServer,
          backupNfsExport: originalSettings.backupNfsExport,
          backupNfsSubpath: originalSettings.backupNfsSubpath,
          backupEncryptionPass: originalSettings.backupEncryptionPass,
          backupWebhookUrl: originalSettings.backupWebhookUrl,
        },
        create: {
          id: "global",
          backupEnabled: originalSettings.backupEnabled,
          backupTime: originalSettings.backupTime,
          backupWeeklyDay: originalSettings.backupWeeklyDay,
          backupMonthlyDay: originalSettings.backupMonthlyDay,
          backupKeepDaily: originalSettings.backupKeepDaily,
          backupKeepWeekly: originalSettings.backupKeepWeekly,
          backupKeepMonthly: originalSettings.backupKeepMonthly,
          backupPreserveConfig: originalSettings.backupPreserveConfig,
          backupStorageType: originalSettings.backupStorageType,
          backupLocalPath: originalSettings.backupLocalPath,
        }
      });
      logger.info("Backup", "Preserved GFS backup settings after restore");
    } catch (e) {
      logger.warn("Backup", `Failed to preserve settings after restore: ${e}`);
    }
  }
}

export async function executeBackup(tier: "MANUAL" | "DAILY" | "WEEKLY" | "MONTHLY" = "MANUAL"): Promise<string | null> {
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const storageConfig = {
    backupStorageType: settings?.backupStorageType || "LOCAL",
    backupLocalPath: settings?.backupLocalPath || "/app/backups",
  };
  const driver = getStorageDriver(storageConfig);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").split("Z")[0];
  const isEncrypted = Boolean(settings?.backupEncryptionPass && settings.backupEncryptionPass.trim() !== "");
  const baseName = `coinflow_${tier.toLowerCase()}_${timestamp}.sql.gz`;
  const filename = isEncrypted ? `${baseName}.enc` : baseName;

  try {
    // 1. Dump database and compress with gzip
    const compressed = await dumpDatabaseSqlGz();

    // 2. Encrypt if passphrase configured
    const finalPayload = isEncrypted ? encryptPayload(compressed, settings?.backupEncryptionPass) : compressed;

    // 3. Store via active driver
    await driver.storeFile(filename, finalPayload);

    // 4. Record catalog entry
    await prisma.backupRecord.upsert({
      where: { filename },
      update: {
        tier,
        storageType: settings?.backupStorageType || "LOCAL",
        fileSize: BigInt(finalPayload.length),
        isEncrypted,
        status: "SUCCESS",
        errorMessage: null,
      },
      create: {
        filename,
        tier,
        storageType: settings?.backupStorageType || "LOCAL",
        fileSize: BigInt(finalPayload.length),
        isEncrypted,
        status: "SUCCESS",
      }
    });

    // 5. Update telemetry
    await prisma.settings.update({
      where: { id: "global" },
      data: {
        backupLastRunAt: new Date(),
        backupLastStatus: "SUCCESS",
        backupLastError: null,
      }
    });

    logger.info("BackupEngine", `Created ${tier} backup snapshot: ${filename}`);

    // 6. Enforce GFS retention if scheduled tier
    if (["DAILY", "WEEKLY", "MONTHLY"].includes(tier)) {
      await enforceGfsRetention();
    }

    return filename;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error("BackupEngine", `Backup failed (${tier})`, error);

    // Record failure in catalog & settings
    try {
      await prisma.backupRecord.upsert({
        where: { filename },
        update: {
          tier,
          storageType: settings?.backupStorageType || "LOCAL",
          fileSize: BigInt(0),
          isEncrypted,
          status: "FAILED",
          errorMessage: errorMsg,
        },
        create: {
          filename,
          tier,
          storageType: settings?.backupStorageType || "LOCAL",
          fileSize: BigInt(0),
          isEncrypted,
          status: "FAILED",
          errorMessage: errorMsg,
        }
      });

      await prisma.settings.update({
        where: { id: "global" },
        data: {
          backupLastRunAt: new Date(),
          backupLastStatus: "FAILED",
          backupLastError: errorMsg,
        }
      });
    } catch {}

    if (tier !== "MANUAL" && settings?.backupWebhookUrl) {
      await dispatchWebhookFailure(settings.backupWebhookUrl, errorMsg, tier);
    }

    return null;
  }
}

export async function createBackupSnapshot(reason: string = "auto"): Promise<string | null> {
  const tier = reason === "daily" ? "DAILY" : (reason === "weekly" ? "WEEKLY" : (reason === "monthly" ? "MONTHLY" : "MANUAL"));
  return executeBackup(tier);
}

export async function enforceGfsRetention(): Promise<string[]> {
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  if (!settings) return [];

  const limits: Record<string, number> = {
    DAILY: settings.backupKeepDaily ?? 7,
    WEEKLY: settings.backupKeepWeekly ?? 4,
    MONTHLY: settings.backupKeepMonthly ?? 3,
  };

  const driver = getStorageDriver({
    backupStorageType: settings.backupStorageType,
    backupLocalPath: settings.backupLocalPath,
  });

  const prunedFiles: string[] = [];

  for (const [tier, keepCount] of Object.entries(limits)) {
    if (keepCount <= 0) continue;

    const records = await prisma.backupRecord.findMany({
      where: { tier, status: "SUCCESS" },
      orderBy: { createdAt: "desc" },
    });

    if (records.length > keepCount) {
      const excess = records.slice(keepCount);
      for (const rec of excess) {
        try {
          await driver.deleteFile(rec.filename);
        } catch (e) {
          logger.warn("BackupEngine", `Failed to delete storage file ${rec.filename}: ${e}`);
        }
        await prisma.backupRecord.delete({ where: { id: rec.id } });
        prunedFiles.push(rec.filename);
      }
    }
  }

  return prunedFiles;
}

export async function syncLocalDirectoryToCatalog(): Promise<void> {
  const dir = BACKUP_DIR;
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql.gz") || f.endsWith(".sql") || f.endsWith(".enc"));
  for (const file of files) {
    const existing = await prisma.backupRecord.findUnique({ where: { filename: file } });
    if (!existing) {
      const stats = fs.statSync(path.join(dir, file));
      let tier = "MANUAL";
      if (file.includes("_daily_")) tier = "DAILY";
      else if (file.includes("_weekly_")) tier = "WEEKLY";
      else if (file.includes("_monthly_")) tier = "MONTHLY";

      await prisma.backupRecord.create({
        data: {
          filename: file,
          tier,
          storageType: "LOCAL",
          fileSize: BigInt(stats.size),
          isEncrypted: file.endsWith(".enc"),
          status: "SUCCESS",
          createdAt: stats.mtime,
        }
      });
    }
  }
}
