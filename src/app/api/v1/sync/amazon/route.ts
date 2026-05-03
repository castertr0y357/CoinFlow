import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { syncAmazon } from "@/lib/services/syncService";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      const csvContent = await file.text();
      const result = await syncAmazon(csvContent);
      
      return NextResponse.json(result);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
