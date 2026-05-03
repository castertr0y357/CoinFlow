import { NextResponse } from 'next/server';
import { syncSimpleFin } from '@/lib/simplefin';

export async function POST() {
  try {
    const result = await syncSimpleFin();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('SimpleFIN sync error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
