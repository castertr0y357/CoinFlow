import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import prisma from "@/lib/prisma";
import { executeBackup, syncLocalDirectoryToCatalog } from "@/lib/services/backupService";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      // Sync local disk files to DB records so any files copied directly show up
      await syncLocalDirectoryToCatalog();

      const records = await prisma.backupRecord.findMany({
        orderBy: { createdAt: "desc" },
      });

      const backups = records.map(r => ({
        id: r.id,
        filename: r.filename,
        tier: r.tier,
        storageType: r.storageType,
        size: Number(r.fileSize),
        isEncrypted: r.isEncrypted,
        status: r.status,
        errorMessage: r.errorMessage,
        createdAt: r.createdAt.toISOString(),
      }));

      return NextResponse.json({ backups });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const body = await req.json().catch(() => ({}));
      const tier = body.tier === "DAILY" ? "DAILY" : (body.tier === "WEEKLY" ? "WEEKLY" : (body.tier === "MONTHLY" ? "MONTHLY" : "MANUAL"));

      const filename = await executeBackup(tier);
      if (!filename) throw new Error("Failed to create snapshot");
      return NextResponse.json({ success: true, filename });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
