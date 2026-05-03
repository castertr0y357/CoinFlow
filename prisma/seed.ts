import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');

  // 1. Initialize Settings
  await prisma.settings.upsert({
    where: { id: 'global' },
    update: {},
    create: {
      id: 'global',
      savingsTarget: 650.00,
    },
  });

  // 2. Initialize Core Categories
  const categories = [
    { name: 'Rent/Mortgage' },
    { name: 'Groceries' },
    { name: 'Utilities' },
    { name: 'Gas/Transit' },
    { name: 'Dining Out' },
    { name: 'Entertainment' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  // 3. Initialize Default User & API Key
  const user = await prisma.user.upsert({
    where: { email: 'admin@webbudget.local' },
    update: {},
    create: {
      email: 'admin@webbudget.local',
      name: 'Admin',
    },
  });

  const systemKey = "system-dev-key-123";
  const hashed = createHash("sha256").update(systemKey).digest("hex");

  await prisma.apiKey.upsert({
    where: { key: hashed },
    update: {},
    create: {
      key: hashed,
      name: "System Key (Internal)",
      userId: user.id
    }
  });

  console.log('Seed completed successfully. System Key: ' + systemKey);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
