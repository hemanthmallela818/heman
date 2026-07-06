import { NextResponse } from 'next/server';
import { fetchSheetData } from '../../../lib/sheets';
import { processStoreData } from '../../../lib/analytics';

// Force Next.js App Router to execute this route dynamically on every request (prevent build-time caching)
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await fetchSheetData();
    const processed = processStoreData(data.inventory, data.sales);
    
    return NextResponse.json({
      success: true,
      ...processed,
      isMock: data.isMock,
      spreadsheetId: data.spreadsheetId,
      error: data.error || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("GET /api/data error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Unknown error occurred while fetching data"
    }, { status: 500 });
  }
}
