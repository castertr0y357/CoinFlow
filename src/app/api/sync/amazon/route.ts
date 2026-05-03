import { NextRequest, NextResponse } from 'next/server';
import { processAmazonCsv } from '@/lib/amazon';

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
  } catch (error: any) {
    console.error('Amazon processing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
