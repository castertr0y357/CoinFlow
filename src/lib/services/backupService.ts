import prisma from "@/lib/prisma";
import fs from "fs";
import path from "path";

const BACKUP_DIR = "/app/backups";

export async function createBackupSnapshot(reason: string = "auto") {
  try {
    // 1. Ensure directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    // 2. Fetch everything (Same logic as export route)
    const [
      transactions,
      accounts,
      categories,
      budgetYears,
      yearlyCategories,
      mortgageDetails,
      valuationProviders,
      settings
    ] = await Promise.all([
      prisma.transaction.findMany({ include: { splits: true } }),
      prisma.account.findMany(),
      prisma.category.findMany(),
      prisma.budgetYear.findMany(),
      prisma.yearlyCategory.findMany(),
      prisma.mortgageDetail.findFirst(),
      prisma.homeValueProvider.findMany(),
      prisma.settings.findFirst()
    ]);

    const backup = {
      version: "1.1",
      timestamp: new Date().toISOString(),
      reason,
      data: {
        transactions,
        accounts,
        categories,
        budgetYears,
        yearlyCategories,
        mortgageDetails,
        valuationProviders,
        settings
      }
    };

    // 3. Save to disk
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").split("Z")[0];
    const filename = `webbudget_${reason}_${timestamp}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
    console.log(`[BackupService] Snapshot created: ${filename}`);

    // 4. Cleanup old backups
    await rotateBackups();

    return filename;
  } catch (error) {
    console.error("[BackupService] Failed to create snapshot:", error);
    return null;
  }
}

async function rotateBackups() {
  try {
    const settings = await prisma.settings.findUnique({ where: { id: "global" } });
    const retentionDays = settings?.backupRetentionDays || 30;
    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;

    const files = fs.readdirSync(BACKUP_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      
      const filepath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filepath);
      const ageDays = (now - stats.mtimeMs) / msInDay;

      if (ageDays > retentionDays) {
        fs.unlinkSync(filepath);
        console.log(`[BackupService] Rotated old backup: ${file}`);
      }
    }
  } catch (error) {
    console.error("[BackupService] Rotation failed:", error);
  }
}

export async function restoreBackupData(data: any) {
  // We use a transaction to ensure atomic restore
  await prisma.$transaction(async (tx) => {
    // 0. Clean up existing data to prevent unique constraint conflicts (in order of dependencies)
    await tx.transactionSplit.deleteMany();
    await tx.transaction.deleteMany();
    await tx.commitment.deleteMany();
    await tx.yearlyCategory.deleteMany();
    await tx.homeValueProvider.deleteMany();
    await tx.mortgageDetail.deleteMany();
    await tx.category.deleteMany();
    await tx.account.deleteMany();
    await tx.externalOrderItem.deleteMany();
    await tx.externalOrder.deleteMany();
    await tx.budgetYear.deleteMany();

    // 1. Restore Accounts FIRST (Categories may depend on them)
    if (data.accounts) {
      for (const acc of data.accounts) {
        await tx.account.upsert({
          where: { id: acc.id },
          update: acc,
          create: acc
        });
      }
    }

    // 2. Restore Categories
    if (data.categories) {
      for (const cat of data.categories) {
        await tx.category.upsert({
          where: { id: cat.id },
          update: cat,
          create: cat
        });
      }
    }

    // 2.1 Restore Budget Years & Yearly Configs (New in v1.1)
    if (data.budgetYears) {
      for (const by of data.budgetYears) {
        await tx.budgetYear.upsert({
          where: { id: by.id },
          update: by,
          create: by
        });
      }
    }

    if (data.yearlyCategories) {
      for (const yc of data.yearlyCategories) {
        await tx.yearlyCategory.upsert({
          where: { yearId_categoryId: { yearId: yc.yearId, categoryId: yc.categoryId } },
          update: yc,
          create: yc
        });
      }
    }

    // 3. Restore Transactions & Splits
    if (data.transactions) {
      for (const t of data.transactions) {
        const { splits, ...txData } = t;
        await tx.transaction.upsert({
          where: { id: t.id },
          update: txData,
          create: txData
        });

        if (splits) {
          for (const s of splits) {
            await tx.transactionSplit.upsert({
              where: { id: s.id },
              update: s,
              create: s
            });
          }
        }
      }
    }

    // 4. Mortgage & Valuations
    if (data.mortgageDetails) {
      await tx.mortgageDetail.upsert({
        where: { accountId: data.mortgageDetails.accountId },
        update: data.mortgageDetails,
        create: data.mortgageDetails
      });
    }

    if (data.valuationProviders) {
      for (const p of data.valuationProviders) {
        await tx.homeValueProvider.upsert({
          where: { id: p.id },
          update: p,
          create: p
        });
      }
    }

    if (data.settings) {
      await tx.settings.upsert({
        where: { id: 'global' },
        update: data.settings,
        create: data.settings
      });
    }
  }, {
    timeout: 60000 // 60 seconds
  });
}
