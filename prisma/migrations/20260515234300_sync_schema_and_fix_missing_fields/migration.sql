-- DropForeignKey
ALTER TABLE "AmazonItem" DROP CONSTRAINT "AmazonItem_amazonOrderId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_amazonOrderId_fkey";

-- DropIndex
DROP INDEX "Transaction_amazonOrderId_key";

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "excludeFromSurplus" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isDebt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "budgetedAmount",
DROP COLUMN "isSavingsTarget",
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tiedAccountId" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "monthlyIncome" DECIMAL(65,30) NOT NULL DEFAULT 5000.00,
ADD COLUMN     "savingsCategoryId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "amazonOrderId",
ADD COLUMN     "externalOrderId" TEXT,
ADD COLUMN     "isHidden" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "AmazonItem";

-- DropTable
DROP TABLE "AmazonOrder";

-- CreateTable
CREATE TABLE "BudgetYear" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YearlyCategory" (
    "id" TEXT NOT NULL,
    "yearId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "monthlyBudget" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "adjustment" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rollover" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YearlyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalOrder" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'AMAZON',
    "date" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalOrderItem" (
    "id" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rawTitle" TEXT,
    "price" DECIMAL(65,30) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "categoryHint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "type" TEXT NOT NULL DEFAULT 'SUBSCRIPTION',
    "nextDueDate" TIMESTAMP(3),
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BudgetYear_year_key" ON "BudgetYear"("year");

-- CreateIndex
CREATE UNIQUE INDEX "YearlyCategory_yearId_categoryId_key" ON "YearlyCategory"("yearId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalOrder_orderId_key" ON "ExternalOrder"("orderId");

-- CreateIndex
CREATE INDEX "Commitment_categoryId_idx" ON "Commitment"("categoryId");

-- CreateIndex
CREATE INDEX "Category_name_idx" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_externalOrderId_key" ON "Transaction"("externalOrderId");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_tiedAccountId_fkey" FOREIGN KEY ("tiedAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YearlyCategory" ADD CONSTRAINT "YearlyCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YearlyCategory" ADD CONSTRAINT "YearlyCategory_yearId_fkey" FOREIGN KEY ("yearId") REFERENCES "BudgetYear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_externalOrderId_fkey" FOREIGN KEY ("externalOrderId") REFERENCES "ExternalOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalOrderItem" ADD CONSTRAINT "ExternalOrderItem_externalOrderId_fkey" FOREIGN KEY ("externalOrderId") REFERENCES "ExternalOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
