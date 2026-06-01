import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { analyzeXlsx, executeHistoricalImport } from "@/lib/services/importService";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const phase = formData.get("phase") as string; // "analyze" or "execute"
      
      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      if (phase === "analyze") {
        const analysis = await analyzeXlsx(buffer);
        return NextResponse.json(analysis);
      } else if (phase === "execute") {
        const year = parseInt(formData.get("year") as string);
        const mappings = JSON.parse(formData.get("mappings") as string);
        
        if (isNaN(year)) {
          return NextResponse.json({ error: "Invalid year" }, { status: 400 });
        }

        const results = await executeHistoricalImport(buffer, year, mappings);
        return NextResponse.json(results);
      }

      return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
    } catch (error) {
      console.error("Import Error:", error);
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });
}
