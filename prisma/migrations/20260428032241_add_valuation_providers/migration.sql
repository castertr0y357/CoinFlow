-- CreateTable
CREATE TABLE "HomeValueProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "lastValue" DECIMAL(65,30),
    "lastSync" TIMESTAMP(3),
    "mortgageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeValueProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeValueProvider_mortgageId_idx" ON "HomeValueProvider"("mortgageId");

-- AddForeignKey
ALTER TABLE "HomeValueProvider" ADD CONSTRAINT "HomeValueProvider_mortgageId_fkey" FOREIGN KEY ("mortgageId") REFERENCES "MortgageDetail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
