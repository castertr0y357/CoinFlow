import { NextResponse } from 'next/server';
import { syncSimpleFin } from '@/lib/simplefin';

export async function POST() {
  try {
    const result = await syncSimpleFin();
    return NextResponse.json(result);
  } catch (error) {
    console.error('SimpleFIN sync error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
