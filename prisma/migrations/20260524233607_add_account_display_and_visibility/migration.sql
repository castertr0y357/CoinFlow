-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "showTransactions" BOOLEAN NOT NULL DEFAULT true;
