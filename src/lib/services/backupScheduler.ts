import prisma from "@/lib/prisma";
import { logger } from "../logger";
import { determineGfsTier, executeBackup } from "./backupService";

let schedulerInterval: NodeJS.Timeout | null = null;

export async function checkAndRunGfsBackup(): Promise<void> {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: "global" } });
    if (!settings || !settings.backupEnabled) return;

    const now = new Date();
    const [targetHour, targetMin] = (settings.backupTime || "02:00").split(":").map(Number);

    const isDueTime = (now.getUTCHours() > targetHour) || 
                      (now.getUTCHours() === targetHour && now.getUTCMinutes() >= targetMin);

    const lastRun = settings.backupLastRunAt;
    const notRunToday = !lastRun || 
      lastRun.getUTCFullYear() !== now.getUTCFullYear() || 
      lastRun.getUTCMonth() !== now.getUTCMonth() || 
      lastRun.getUTCDate() !== now.getUTCDate();

    if (isDueTime && notRunToday) {
      // Postgres advisory lock (arbitrary unique lock ID: 987654321) to prevent race conditions across multi-pods
      const lockAcquired = await prisma.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`SELECT pg_try_advisory_lock(987654321)`;
      const hasLock = lockAcquired && lockAcquired[0]?.pg_try_advisory_lock;

      if (hasLock) {
        try {
          // Re-verify notRunToday after acquiring lock
          const freshSettings = await prisma.settings.findUnique({ where: { id: "global" } });
          const freshLastRun = freshSettings?.backupLastRunAt;
          const stillNotRunToday = !freshLastRun || 
            freshLastRun.getUTCFullYear() !== now.getUTCFullYear() || 
            freshLastRun.getUTCMonth() !== now.getUTCMonth() || 
            freshLastRun.getUTCDate() !== now.getUTCDate();

          if (stillNotRunToday) {
            const tier = determineGfsTier(now, {
              backupWeeklyDay: freshSettings?.backupWeeklyDay ?? 0,
              backupMonthlyDay: freshSettings?.backupMonthlyDay ?? 1,
            });
            logger.info("BackupScheduler", `Executing scheduled ${tier} database backup...`);
            await executeBackup(tier);
            logger.info("BackupScheduler", `Scheduled ${tier} database backup succeeded.`);
          }
        } finally {
          await prisma.$executeRaw`SELECT pg_advisory_unlock(987654321)`;
        }
      }
    }
  } catch (error) {
    logger.error("BackupScheduler", "Error in scheduler check", error);
  }
}

export function startGfsBackupScheduler(): void {
  if (schedulerInterval) return;
  logger.info("BackupScheduler", "Started automated GFS backup daemon loop.");
  // Run check every 60 seconds
  schedulerInterval = setInterval(checkAndRunGfsBackup, 60 * 1000);
}
