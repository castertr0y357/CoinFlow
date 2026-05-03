import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const backup = await req.json();
      
      if (!backup.data || backup.version !== "1.0") {
        return NextResponse.json({ error: "Invalid backup format" }, { status: 400 });
      }

      const { data } = backup;

      // We use a transaction to ensure atomic restore
      await prisma.$transaction(async (tx) => {
        // 1. Restore Categories
        if (data.categories) {
          for (const cat of data.categories) {
            await tx.category.upsert({
              where: { id: cat.id },
              update: cat,
              create: cat
            });
          }
        }

        // 2. Restore Accounts
        if (data.accounts) {
          for (const acc of data.accounts) {
            await tx.account.upsert({
              where: { id: acc.id },
              update: acc,
              create: acc
            });
          }
        }

        // 3. Restore Transactions & Splits
        if (data.transactions) {
          // Clear current transactions to avoid split conflicts if doing a full restore
          // Alternatively, we can upsert
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

        // 5. Settings
        if (data.settings) {
          await tx.settings.upsert({
            where: { id: 'global' },
            update: data.settings,
            create: data.settings
          });
        }
      });

      return NextResponse.json({ success: true });
    } catch (error: any) {
      console.error("Import error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
