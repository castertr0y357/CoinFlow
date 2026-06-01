import { NextRequest, NextResponse } from 'next/server';
import { processAmazonCsv } from '@/lib/external-orders';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const csvContent = await file.text();
    const result = await processAmazonCsv(csvContent);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Amazon processing error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
