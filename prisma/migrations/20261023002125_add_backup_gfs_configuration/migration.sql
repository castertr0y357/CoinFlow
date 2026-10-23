-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "backupCifsDomain" TEXT,
ADD COLUMN     "backupCifsPassword" TEXT,
ADD COLUMN     "backupCifsServer" TEXT,
ADD COLUMN     "backupCifsShare" TEXT,
ADD COLUMN     "backupCifsSubpath" TEXT,
ADD COLUMN     "backupCifsUsername" TEXT,
ADD COLUMN     "backupEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "backupEncryptionPass" TEXT,
ADD COLUMN     "backupKeepDaily" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "backupKeepMonthly" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "backupKeepWeekly" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "backupLastError" TEXT,
ADD COLUMN     "backupLastRunAt" TIMESTAMP(3),
ADD COLUMN     "backupLastStatus" TEXT,
ADD COLUMN     "backupLocalPath" TEXT NOT NULL DEFAULT '/app/backups',
ADD COLUMN     "backupMonthlyDay" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "backupNfsExport" TEXT,
ADD COLUMN     "backupNfsServer" TEXT,
ADD COLUMN     "backupNfsSubpath" TEXT,
ADD COLUMN     "backupPreserveConfig" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "backupS3AccessKey" TEXT,
ADD COLUMN     "backupS3Bucket" TEXT,
ADD COLUMN     "backupS3Endpoint" TEXT,
ADD COLUMN     "backupS3Prefix" TEXT DEFAULT 'coinflow/',
ADD COLUMN     "backupS3Region" TEXT DEFAULT 'us-east-1',
ADD COLUMN     "backupS3SecretKey" TEXT,
ADD COLUMN     "backupStorageType" TEXT NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "backupTime" TEXT NOT NULL DEFAULT '02:00',
ADD COLUMN     "backupWebhookUrl" TEXT,
ADD COLUMN     "backupWeeklyDay" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BackupRecord" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'MANUAL',
    "storageType" TEXT NOT NULL DEFAULT 'LOCAL',
    "fileSize" BIGINT NOT NULL DEFAULT 0,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackupRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BackupRecord_filename_key" ON "BackupRecord"("filename");

-- CreateIndex
CREATE INDEX "BackupRecord_tier_createdAt_idx" ON "BackupRecord"("tier", "createdAt");
