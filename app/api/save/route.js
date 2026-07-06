import { NextResponse } from 'next/server';
import { saveSheetChanges } from '../../../lib/sheets';

// Force Next.js App Router to run this route dynamically
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({
        success: false,
        error: "Invalid payload: 'updates' must be a JSON array"
      }, { status: 400 });
    }

    if (updates.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No updates were sent"
      });
    }

    const result = await saveSheetChanges(updates);
    
    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error("POST /api/save error:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to save updates to the Google Sheet"
    }, { status: 500 });
  }
}
