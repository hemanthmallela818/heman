import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  
  // Remove session cookie
  response.cookies.set('admin_session', '', {
    httpOnly: true,
    path: '/',
    maxAge: 0, // Expire immediately
  });

  return response;
}
