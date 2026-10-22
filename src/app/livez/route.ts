import { NextResponse } from 'next/server';

export async function GET() {
  return new NextResponse('OK', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
