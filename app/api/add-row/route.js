import { NextResponse } from 'next/server';
import { appendSheetRow } from '../../../lib/sheets';

// Force Next.js App Router to run this route dynamically
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { tab, rowData } = body;

    if (!tab || !rowData || typeof rowData !== 'object') {
      return NextResponse.json({
        success: false,
        error: "Invalid payload: 'tab' must be a string and 'rowData' must be an object"
      }, { status: 400 });
    }

    const result = await appendSheetRow(tab, rowData);
    
    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("POST /api/add-row error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to add row to the Google Sheet"
    }, { status: 500 });
  }
}
