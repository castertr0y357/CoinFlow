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

      // Magic bytes verification
      const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
      const isXls = buffer.length >= 8 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0 && buffer[4] === 0xa1 && buffer[5] === 0xb1 && buffer[6] === 0x1a && buffer[7] === 0xe1;
      
      // Basic text file verification (for CSVs)
      let isCsv = false;
      if (!isZip && !isXls) {
        const textSample = buffer.toString('utf-8', 0, Math.min(buffer.length, 1024));
        isCsv = !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(textSample);
      }

      if (!isZip && !isXls && !isCsv) {
        return NextResponse.json({ error: "Invalid file format. Only Excel (XLSX/XLS) or CSV files are allowed." }, { status: 400 });
      }

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
