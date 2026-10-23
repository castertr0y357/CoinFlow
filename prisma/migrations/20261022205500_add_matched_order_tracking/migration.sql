-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "matchedOrderId" TEXT,
ADD COLUMN "matchedOrderSource" TEXT;

-- CreateIndex
CREATE INDEX "ExternalOrder_source_totalAmount_date_idx" ON "ExternalOrder"("source", "totalAmount", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_matchedOrderId_key" ON "Transaction"("matchedOrderId");

-- CreateIndex
CREATE INDEX "Transaction_matchedOrderId_idx" ON "Transaction"("matchedOrderId");
