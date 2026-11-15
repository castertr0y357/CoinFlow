import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, verifyIdToken, isOidcEnabled } from "@/lib/oidc";
import { encrypt, getCookieOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  if (!isOidcEnabled()) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code || !state) {
    logger.error("AUTH/OIDC", "OIDC callback error or missing parameters", { error });
    return NextResponse.redirect(new URL("/login?error=oidc_failed", req.url));
  }

  const rawStateCookie = req.cookies.get("coinflow_oidc_state")?.value;
  if (!rawStateCookie) {
    logger.error("AUTH/OIDC", "Missing oidc state cookie");
    return NextResponse.redirect(new URL("/login?error=state_missing", req.url));
  }

  let stateData: { state: string; codeVerifier: string };
  try {
    stateData = JSON.parse(Buffer.from(rawStateCookie, "base64").toString("utf8"));
  } catch {
    logger.error("AUTH/OIDC", "Invalid state cookie encoding");
    return NextResponse.redirect(new URL("/login?error=invalid_state", req.url));
  }

  if (stateData.state !== state) {
    logger.error("AUTH/OIDC", "State mismatch in OIDC callback");
    return NextResponse.redirect(new URL("/login?error=state_mismatch", req.url));
  }

  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/v1/auth/oidc/callback`;

  try {
    const tokens = await exchangeCodeForTokens(code, stateData.codeVerifier, redirectUri);
    const idToken = tokens.id_token;
    if (!idToken) {
      throw new Error("Missing id_token in token response");
    }

    const payload = await verifyIdToken(idToken);
    const email = (payload.email as string) || "admin@webbudget.local";
    const groups = (payload.groups as string[]) || [];

    // Check optional OIDC_REQUIRED_GROUP
    const requiredGroup = process.env.OIDC_REQUIRED_GROUP;
    if (requiredGroup && !groups.includes(requiredGroup)) {
      logger.warn("AUTH/OIDC", `User ${email} lacks required group '${requiredGroup}'`);
      return NextResponse.redirect(new URL("/login?error=unauthorized_group", req.url));
    }

    // Upsert user in database to ensure relation consistency
    await prisma.user.upsert({
      where: { email },
      update: {
        name: (payload.name as string) || email.split("@")[0],
      },
      create: {
        email,
        name: (payload.name as string) || email.split("@")[0],
      },
    });

    // Also ensure admin@webbudget.local exists as primary single-vault link
    await prisma.user.upsert({
      where: { email: "admin@webbudget.local" },
      update: {},
      create: {
        email: "admin@webbudget.local",
        name: "Admin",
      },
    });

    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const session = await encrypt({
      user: "admin",
      email,
      expiresAt,
    });

    const response = NextResponse.redirect(new URL("/", req.url));
    response.cookies.set({
      name: "session",
      value: session,
      expires: new Date(expiresAt),
      ...getCookieOptions(),
    });

    // Clear state cookie
    response.cookies.set({
      name: "coinflow_oidc_state",
      value: "",
      expires: new Date(0),
      ...getCookieOptions(),
    });

    logger.info("AUTH/OIDC", `Successfully authenticated user ${email} via Authentik OIDC`);
    return response;
  } catch (err) {
    logger.error("AUTH/OIDC", "Failed to complete OIDC callback", err);
    return NextResponse.redirect(new URL("/login?error=token_verification_failed", req.url));
  }
}
