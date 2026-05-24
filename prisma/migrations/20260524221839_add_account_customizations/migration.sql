-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "excludeFromAssetCalculation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showInSidebar" BOOLEAN NOT NULL DEFAULT true;
