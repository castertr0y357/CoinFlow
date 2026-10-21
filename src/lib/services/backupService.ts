import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { spawn } from "child_process";
import { logger } from "../logger";

const BACKUP_DIR = "/app/backups";

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
          const compatibleSql = rawSql.replace(/^SET transaction_timeout = .*;\r?\n/gm, "");
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
    const compatibleSql = sqlStr.replace(/^SET transaction_timeout = .*;\r?\n/gm, "");
    proc.stdin.write(compatibleSql);
    proc.stdin.end();
  });
}

export async function restoreDatabaseFromBuffer(fileBuffer: Buffer, filename: string): Promise<void> {
  let sqlBuffer: Buffer;
  const isGzip = filename.endsWith(".gz") || (fileBuffer.length >= 2 && fileBuffer[0] === 0x1f && fileBuffer[1] === 0x8b);
  if (isGzip) {
    sqlBuffer = zlib.gunzipSync(fileBuffer);
  } else {
    sqlBuffer = fileBuffer;
  }

  await restoreDatabaseSql(sqlBuffer);
}

export async function createBackupSnapshot(reason: string = "auto"): Promise<string | null> {
  try {
    // 1. Ensure directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
    }

    // 2. Dump database and compress with gzip
    const compressed = await dumpDatabaseSqlGz();

    // 3. Save to disk with restricted permissions
    const safeReason = reason.replace(/[^a-zA-Z0-9_-]/g, "");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").split("Z")[0];
    const filename = `webbudget_${safeReason || "auto"}_${timestamp}.sql.gz`;
    const filepath = path.join(BACKUP_DIR, filename);

    fs.writeFileSync(filepath, compressed, { mode: 0o600 });
    logger.info("Backup", `Snapshot created: ${filename}`);

    // 4. Cleanup old backups
    await rotateBackups();

    return filename;
  } catch (error) {
    logger.error("Backup", "Failed to create snapshot", error);
    return null;
  }
}

async function rotateBackups(): Promise<void> {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: "global" } });
    const retentionDays = settings?.backupRetentionDays || 30;
    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;

    const files = fs.readdirSync(BACKUP_DIR);
    for (const file of files) {
      if (!file.endsWith(".sql.gz")) continue;

      const filepath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filepath);
      const ageDays = (now - stats.mtimeMs) / msInDay;

      if (ageDays > retentionDays) {
        fs.unlinkSync(filepath);
        logger.info("Backup", `Rotated old backup: ${file}`);
      }
    }
  } catch (error) {
    logger.error("Backup", "Rotation failed", error);
  }
}

