import { NextResponse } from 'next/server';

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets, login pages, and API auth routes
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get('admin_session');
  const isAuthenticated = session && session.value === 'authenticated';

  // 2. Protect internal API routes
  if (pathname.startsWith('/api')) {
    if (!isAuthenticated) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized. Please login.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return NextResponse.next();
  }

  // 3. Protect UI Pages (e.g. /, /data)
  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Catch all routes except next internals, image serving, and assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
