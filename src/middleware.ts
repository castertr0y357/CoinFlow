import { NextRequest, NextResponse } from "next/server";
import { decrypt, updateSession } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host") || "unknown";

  // 1. Always allow preflight requests with CORS headers
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-API-KEY, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // 2. Allow public assets and login page
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/login" ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname === "/coinflow-extension.zip" ||
    pathname.startsWith("/api/v1/auth") ||
    // Allow background sync with API Key
    pathname.startsWith("/api/v1/sync/background") ||
    request.headers.has("X-API-KEY")
  ) {
    return NextResponse.next();
  }

  // 3. Check session
  const allCookies = request.cookies.getAll();
  const session = request.cookies.get("session")?.value;

  if (!session) {
    console.log(`[MIDDLEWARE] Redirect to /login. Reason: No session cookie. Path: ${pathname}. Protocol: ${protocol}, Host: ${host}. Cookies found: ${allCookies.map(c => c.name).join(", ")}`);
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      response.headers.set("Access-Control-Allow-Origin", "*");
      return response;
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const parsed = await decrypt(session);
  if (!parsed) {
    console.log(`[MIDDLEWARE] Redirect to /login. Reason: Invalid session. Path: ${pathname}`);
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
