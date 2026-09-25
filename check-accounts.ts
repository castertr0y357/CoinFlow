import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAccounts() {
  console.log("Checking accounts in database...");
  
  const accounts = await prisma.account.findMany({
    include: {
      transactions: {
        orderBy: { date: 'desc' },
        take: 1
      }
    }
  });

  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
  
  console.log(`\nLast Global Sync Date: ${settings?.lastSync ? settings.lastSync.toISOString() : 'Never'}`);
  console.log(`\nFound ${accounts.length} accounts:\n`);

  for (const acc of accounts) {
    const latestTx = acc.transactions[0];
    console.log(`Account: ${acc.name}`);
    console.log(`- Balance: ${acc.balance} ${acc.currency}`);
    console.log(`- Is Hidden (Exclude from Surplus): ${acc.excludeFromSurplus}`);
    console.log(`- Latest Transaction: ${latestTx ? latestTx.date.toISOString() : 'None'}`);
    console.log(`- Transaction Amount: ${latestTx ? latestTx.amount : 'N/A'} (Payee: ${latestTx?.payee || 'N/A'})`);
    console.log(`-----------------------------------`);
  }

  await prisma.$disconnect();
}

checkAccounts().catch(e => {
  console.error(e);
  process.exit(1);
});
