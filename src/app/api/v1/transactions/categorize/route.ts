import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-utils";
import { categorizeSplit } from "@/lib/services/transactionService";

export async function PATCH(req: NextRequest) {
  return withAuth(req, async () => {
    const body = await req.json();
    const { splitId, categoryId } = body;

    if (!splitId) {
      return NextResponse.json({ error: "Missing splitId" }, { status: 400 });
    }

    const updated = await categorizeSplit(splitId, categoryId);
    return NextResponse.json(updated);
  });
}
