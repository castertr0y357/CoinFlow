import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

export async function runSeed(client: PrismaClient = prisma) {
  console.log('Seeding data...');

  // 1. Initialize Settings
  await client.settings.upsert({
    where: { id: 'global' },
    update: {},
    create: {
      id: 'global',
      savingsTarget: 650.00,
    },
  });

  // 2. Initialize Core Categories only if no categories exist yet
  const existingCategoryCount = await client.category.count();
  if (existingCategoryCount === 0) {
    const categories = [
      { name: 'Rent/Mortgage' },
      { name: 'Groceries' },
      { name: 'Utilities' },
      { name: 'Gas/Transit' },
      { name: 'Dining Out' },
      { name: 'Entertainment' },
    ];

    for (const cat of categories) {
      await client.category.upsert({
        where: { name: cat.name },
        update: {},
        create: cat,
      });
    }
    console.log('Seeded default categories.');
  } else {
    console.log(`Skipping default category seeding (${existingCategoryCount} categories already exist).`);
  }

  // 3. Initialize Default User & API Key
  const user = await client.user.upsert({
    where: { email: 'admin@webbudget.local' },
    update: {},
    create: {
      email: 'admin@webbudget.local',
      name: 'Admin',
    },
  });

  const systemKey = "system-dev-key-123";
  const hashed = createHash("sha256").update(systemKey).digest("hex");

  await client.apiKey.upsert({
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

const isDirectExecution = process.argv[1]?.replace(/\\/g, '/').endsWith('prisma/seed.ts');
if (isDirectExecution) {
  runSeed()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
