-- CreateTable
CREATE TABLE "NetWorthSnapshot" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "assets" DECIMAL(65,30) NOT NULL,
    "debts" DECIMAL(65,30) NOT NULL,
    "homeValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "investments" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "netWorth" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetWorthSnapshot_monthKey_key" ON "NetWorthSnapshot"("monthKey");
