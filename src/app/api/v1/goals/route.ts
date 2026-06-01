import { NextResponse } from "next/server";
import { getGoals } from "@/lib/services/goalService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const goals = await getGoals();
    return NextResponse.json({ goals });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch goals";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
