-- AlterTable
ALTER TABLE "Category" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Category_isArchived_idx" ON "Category"("isArchived");
