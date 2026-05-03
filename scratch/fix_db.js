const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "expectedMonthlyIncome" DECIMAL(65,30) DEFAULT 5000.00;`);
    console.log("Success: Column added.");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
