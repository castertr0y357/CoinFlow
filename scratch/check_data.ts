import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const catCount = await prisma.category.count();
  const txCount = await prisma.transaction.count();
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });

  console.log(`Categories: ${catCount}`);
  console.log(`Transactions: ${txCount}`);
  console.log(`Settings: ${JSON.stringify(settings)}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
