import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    // Fetch everything
    const [
      transactions,
      accounts,
      categories,
      mortgageDetails,
      valuationProviders,
      settings
    ] = await Promise.all([
      prisma.transaction.findMany({ include: { splits: true } }),
      prisma.account.findMany(),
      prisma.category.findMany(),
      prisma.mortgageDetail.findFirst(),
      prisma.homeValueProvider.findMany(),
      prisma.settings.findFirst()
    ]);

    const backup = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      data: {
        transactions,
        accounts,
        categories,
        mortgageDetails,
        valuationProviders,
        settings
      }
    };

    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="webbudget_backup_${new Date().toISOString().split('T')[0]}.json"`
      }
    });
  });
}
