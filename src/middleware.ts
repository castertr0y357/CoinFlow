import { NextRequest, NextResponse } from "next/server";
import { decrypt, updateSession, encrypt, getCookieOptions } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rawProto = request.headers.get("x-forwarded-proto") || "http";
  const protocol = rawProto.split(",")[0].trim();
  const host = request.headers.get("host") || "unknown";
  
  // 1. Generate Correlation ID for trace logging
  const correlationId = request.headers.get("X-Correlation-ID") || crypto.randomUUID();

  console.log(`[MIDDLEWARE] [Id: ${correlationId}] Request: ${request.method} ${pathname} | Protocol: ${protocol} | Host: ${host}`);

  // 2. Always allow preflight requests with CORS headers
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

  // 3. CSRF Verification for state-modifying requests (POST, PUT, DELETE, PATCH)
  if (["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
    const hasApiKey = request.headers.has("X-API-KEY");
    if (!hasApiKey) {
      const origin = request.headers.get("origin");
      if (origin) {
        const rawHost = request.headers.get("x-forwarded-host") || host;
        const forwardedHost = rawHost.split(",")[0].trim();
        const rawProto = request.headers.get("x-forwarded-proto") || "http";
        const forwardedProto = rawProto.split(",")[0].trim();
        const expectedOrigin = `${forwardedProto}://${forwardedHost}`;

        try {
          if (origin === "null") {
            console.error(`[CSRF] [Id: ${correlationId}] Blocked request from null origin`);
            return new NextResponse(JSON.stringify({ error: "CSRF Verification Failed" }), {
              status: 403,
              headers: { 
                "Content-Type": "application/json",
                "X-Correlation-ID": correlationId
              }
            });
          }

          const originUrl = new URL(origin);
          const expectedUrl = new URL(expectedOrigin);

          if (originUrl.host !== expectedUrl.host) {
            console.error(`[CSRF] [Id: ${correlationId}] Blocked request from origin: ${origin} | Expected host: ${expectedUrl.host}`);
            return new NextResponse(JSON.stringify({ error: "CSRF Verification Failed" }), {
              status: 403,
              headers: { 
                "Content-Type": "application/json",
                "X-Correlation-ID": correlationId
              }
            });
          }
        } catch (err) {
          console.error(`[CSRF] [Id: ${correlationId}] Origin parsing error`, err);
          return new NextResponse(JSON.stringify({ error: "Invalid Origin header" }), {
            status: 400,
            headers: { 
              "Content-Type": "application/json",
              "X-Correlation-ID": correlationId
            }
          });
        }
      }
    }
  }

  // 4. Allow public assets and login page
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
    const response = NextResponse.next();
    response.headers.set("X-Correlation-ID", correlationId);
    return response;
  }

  // 5. SSO Header Integration
  const trustProxy = process.env.TRUST_PROXY_HEADERS === "true";
  const ssoUser = trustProxy ? (request.headers.get("x-forwarded-user") || request.headers.get("remote-user") || request.headers.get("tailscale-user-login")) : null;

  if (ssoUser) {
    const sessionCookie = request.cookies.get("session")?.value;
    let isValidSession = false;
    if (sessionCookie) {
      const parsed = await decrypt(sessionCookie);
      if (parsed && parsed.user === "admin") {
        isValidSession = true;
      }
    }

    if (!isValidSession) {
      console.log(`[SSO] [Id: ${correlationId}] Auto-logging in user from proxy header: ${ssoUser}`);
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const newSessionValue = await encrypt({ user: "admin", expiresAt });
      const response = NextResponse.next();
      response.cookies.set({
        name: "session",
        value: newSessionValue,
        expires: new Date(expiresAt),
        ...getCookieOptions(),
      });
      response.headers.set("X-Correlation-ID", correlationId);
      return response;
    }
  }

  // 6. Check session
  const session = request.cookies.get("session")?.value;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      response.headers.set("Access-Control-Allow-Origin", "*");
      response.headers.set("X-Correlation-ID", correlationId);
      return response;
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const parsed = await decrypt(session);
  if (!parsed) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // 7. Update session (refresh expiration)
  const res = await updateSession(request);
  if (res) {
    res.headers.set("X-Correlation-ID", correlationId);
    return res;
  }

  const defaultRes = NextResponse.next();
  defaultRes.headers.set("X-Correlation-ID", correlationId);
  return defaultRes;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    "/api/v1/:path*"
  ],
};
