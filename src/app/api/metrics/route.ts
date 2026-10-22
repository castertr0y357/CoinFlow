import { NextResponse } from 'next/server';
import { metrics } from '@/lib/logger';

export async function GET() {
  const output = metrics.generateMetrics();
  return new NextResponse(output, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
