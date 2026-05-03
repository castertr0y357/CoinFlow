import { NextRequest, NextResponse } from "next/server";
import { decrypt, updateSession } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public assets and login page
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/login" ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/api/v1/auth") ||
    // Allow background sync with API Key
    pathname.startsWith("/api/v1/sync/background")
  ) {
    return NextResponse.next();
  }

  // 2. Check session
  const session = request.cookies.get("session")?.value;

  if (!session) {
    console.log(`[MIDDLEWARE] No session cookie found for ${pathname}. Redirecting to /login`);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const parsed = await decrypt(session);
  if (!parsed) {
    console.log(`[MIDDLEWARE] Invalid session for ${pathname}. Redirecting to /login`);
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 3. Update session (refresh expiration)
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    "/api/v1/:path*"
  ],
};
