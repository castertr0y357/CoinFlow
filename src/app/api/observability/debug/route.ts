import { NextRequest, NextResponse } from 'next/server';
import { isDebugEnabled, setDebugLogging } from '@/lib/logger';

export async function GET() {
  return NextResponse.json({ debug_enabled: isDebugEnabled() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const enabled = Boolean(body.enabled);
    setDebugLogging(enabled);
    return NextResponse.json({
      debug_enabled: isDebugEnabled(),
      message: `Debug logging set to ${enabled}`,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
}
