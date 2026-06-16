import { NextRequest, NextResponse } from "next/server";
import { login, getCookieOptions } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/security";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const limitResult = rateLimit(ip, 5, 60 * 1000); // 5 attempts per minute

    if (limitResult.isBlocked) {
      logger.warn("AUTH", `Login rate limited for IP: ${ip}`);
      return NextResponse.json(
        { error: "Too many login attempts. Please try again in 1 minute." },
        { status: 429 }
      );
    }

    const { password } = await req.json();
    const result = await login(password);

    if (result) {
      const { session, expiresAt } = result;
      const response = NextResponse.json({ success: true });

      // Explicitly set the cookie on the response object
      response.cookies.set({
        name: "session",
        value: session,
        expires: new Date(expiresAt),
        ...getCookieOptions(),
      });

      logger.info("AUTH", "Login successful. Session cookie attached to response.");
      return response;
    } else {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
  } catch (error) {
    logger.error("AUTH", "Login error", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
