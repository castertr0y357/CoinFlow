-- CreateTable
CREATE TABLE "MortgageDetail" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "interestRate" DECIMAL(65,30) NOT NULL,
    "monthlyPayment" DECIMAL(65,30) NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "termMonths" INTEGER NOT NULL DEFAULT 360,
    "homeValue" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MortgageDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MortgageDetail_accountId_key" ON "MortgageDetail"("accountId");

-- AddForeignKey
ALTER TABLE "MortgageDetail" ADD CONSTRAINT "MortgageDetail_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
