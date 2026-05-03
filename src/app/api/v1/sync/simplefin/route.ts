import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { syncSimpleFin } from "@/lib/services/syncService";

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const result = await syncSimpleFin();
      return NextResponse.json(result);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  });
}
