import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { dumpDatabaseSqlGz } from "@/lib/services/backupService";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const compressed = await dumpDatabaseSqlGz();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").split("Z")[0];

      return new NextResponse(new Uint8Array(compressed), {
        headers: {
          "Content-Type": "application/gzip",
          "Content-Disposition": `attachment; filename="webbudget_backup_${timestamp}.sql.gz"`
        }
      });
    } catch (error) {
      logger.error("Backup", "Export error", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
