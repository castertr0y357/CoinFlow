-- CreateTable
CREATE TABLE "DebtDetail" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "interestRate" DECIMAL(65,30) NOT NULL,
    "minimumPayment" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DebtDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DebtDetail_accountId_key" ON "DebtDetail"("accountId");

-- AddForeignKey
ALTER TABLE "DebtDetail" ADD CONSTRAINT "DebtDetail_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
