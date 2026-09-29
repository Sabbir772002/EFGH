// middleware.ts — Next.js edge middleware for route protection.
// Runs on every request BEFORE the page renders (server-side, edge runtime).
//
// Rules:
//  /passenger/* → must have valid tesla_token cookie → else redirect to /login
//  /driver/*    → must have valid tesla_token cookie → else redirect to /login
//  /login, /register, / → always public

import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_TOKEN } from '@/lib/constants';

// Protected path prefixes — any route starting with these requires auth.
const PROTECTED = ['/passenger', '/driver'];

// Public paths — always accessible regardless of auth state.
// (Listing them explicitly avoids accidentally blocking static assets.)
const PUBLIC_PATHS = ['/', '/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this path requires authentication
  const isProtected = PROTECTED.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) {
    return NextResponse.next();
  }

  // Read JWT cookie set by useAuth on login
  const token = request.cookies.get(COOKIE_TOKEN)?.value;

  if (!token) {
    // Redirect to login, preserving the originally requested URL as ?redirect=
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Token exists — allow request through.
  // Note: We do NOT verify the JWT signature here (edge runtime has no crypto).
  // The backend verifies the signature on every API call and returns 401 if invalid.
  // A 401 from any hook will trigger logout() in the client.
  return NextResponse.next();
}

// Tell Next.js which paths this middleware should run on.
// Exclude _next internals, API routes, and static files.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
};
