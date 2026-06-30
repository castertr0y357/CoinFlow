import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const accounts = await prisma.account.findMany();
    console.log("=== Accounts ===");
    for (const acc of accounts) {
      console.log(`ID: ${acc.id} | RemoteID: ${acc.remoteId} | Name: ${acc.name} | DisplayName: ${acc.displayName} | Balance: ${acc.balance} | Exclude: ${acc.excludeFromSurplus}`);
    }

    const simplefinToken = await prisma.settings.findUnique({
      where: { id: 'global' },
      select: { simpleFinToken: true, lastSync: true }
    });
    console.log("\n=== SimpleFIN Configuration ===");
    console.log(`Token set: ${!!simplefinToken?.simpleFinToken}`);
    console.log(`Last Sync: ${simplefinToken?.lastSync}`);

    // If "Checking 9719" exists, let's log details and its transaction count
    const checkingAcc = accounts.find(a => a.name.includes("9719") || (a.displayName && a.displayName.includes("9719")));
    if (checkingAcc) {
      console.log(`\n=== Checking 9719 Details ===`);
      const txCount = await prisma.transaction.count({
        where: { accountId: checkingAcc.id }
      });
      console.log(`Transaction count: ${txCount}`);
      
      const lastTxs = await prisma.transaction.findMany({
        where: { accountId: checkingAcc.id },
        orderBy: { date: 'desc' },
        take: 5
      });
      console.log(`Last 5 transactions:`);
      for (const tx of lastTxs) {
        console.log(`  Date: ${tx.date.toISOString().slice(0,10)} | Amount: ${tx.amount} | Payee: ${tx.payee} | RemoteID: ${tx.remoteId}`);
      }
    } else {
      console.log("\nChecking 9719 account not found in DB.");
    }
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
