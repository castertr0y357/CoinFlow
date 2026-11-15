import { createRemoteJWKSet, jwtVerify } from "jose";
import crypto from "crypto";

export function isOidcEnabled(): boolean {
  return process.env.OIDC_ENABLED === "true";
}

export function generatePKCE() {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  const state = crypto.randomBytes(16).toString("hex");

  return { codeVerifier, codeChallenge, state };
}

export function buildAuthorizationUrl(codeChallenge: string, state: string, redirectUri: string) {
  const authEndpoint =
    process.env.OIDC_OP_AUTHORIZATION_ENDPOINT ||
    "https://auth.castertr0y357.net/application/o/authorize/";
  const clientId = process.env.OIDC_RP_CLIENT_ID || "coinflow-oidc-client";
  const scope = "openid email profile";

  const url = new URL(authEndpoint);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return url.toString();
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  redirectUri: string
) {
  const tokenEndpoint =
    process.env.OIDC_OP_TOKEN_ENDPOINT ||
    "https://auth.castertr0y357.net/application/o/token/";
  const clientId = process.env.OIDC_RP_CLIENT_ID || "coinflow-oidc-client";
  const clientSecret = process.env.OIDC_RP_CLIENT_SECRET || "";

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  });

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${errorText}`);
  }

  return await response.json();
}

export async function verifyIdToken(idToken: string) {
  const jwksUri =
    process.env.OIDC_OP_JWKS_ENDPOINT ||
    "https://auth.castertr0y357.net/application/o/coinflow/jwks/";
  const JWKS = createRemoteJWKSet(new URL(jwksUri));

  const { payload } = await jwtVerify(idToken, JWKS);
  return payload;
}
