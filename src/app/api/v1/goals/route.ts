import { NextResponse } from "next/server";
import { getGoals } from "@/lib/services/goalService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const goals = await getGoals();
    return NextResponse.json({ goals });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch goals" }, { status: 500 });
  }
}
