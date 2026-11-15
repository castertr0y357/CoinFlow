import { NextRequest, NextResponse } from "next/server";
import { generatePKCE, buildAuthorizationUrl, isOidcEnabled } from "@/lib/oidc";
import { getCookieOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!isOidcEnabled()) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const { codeVerifier, codeChallenge, state } = generatePKCE();
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/v1/auth/oidc/callback`;
  const authUrl = buildAuthorizationUrl(codeChallenge, state, redirectUri);

  const response = NextResponse.redirect(authUrl);

  // Store state and codeVerifier in short-lived HttpOnly cookie (10 minutes)
  const stateData = JSON.stringify({ state, codeVerifier });
  response.cookies.set({
    name: "coinflow_oidc_state",
    value: Buffer.from(stateData).toString("base64"),
    expires: new Date(Date.now() + 10 * 60 * 1000),
    ...getCookieOptions(),
  });

  return response;
}
