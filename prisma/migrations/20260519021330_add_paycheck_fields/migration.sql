-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "paycheckAmount" DECIMAL(65,30) NOT NULL DEFAULT 0.00,
ADD COLUMN     "paycheckEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paycheckFrequency" TEXT NOT NULL DEFAULT 'BI_WEEKLY',
ADD COLUMN     "paycheckNextDate" TIMESTAMP(3);
