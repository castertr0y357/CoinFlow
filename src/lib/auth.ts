import { SignJWT, jwtVerify, JWTPayload } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import prisma from "./prisma";
import { logger } from "./logger";

const SECRET = new TextEncoder().encode(
  process.env.APP_PASSWORD || "change-this-default-password-12345"
);

export interface SessionPayload {
  user: string;
  expiresAt: number;
  [key: string]: unknown;
}

export async function encrypt(payload: SessionPayload) {
  return await new SignJWT(payload as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(input, SECRET, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch (err) {
    logger.error("Auth/Decrypt", "Decrypt failed", err);
    return null;
  }
}

export function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  const secureOverride = process.env.SECURE_COOKIES;
  const secure = secureOverride === "true" ? true : (secureOverride === "false" ? false : isProduction);

  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function login(password: string) {
  const expectedPassword = process.env.APP_PASSWORD || "admin";
  
  if (password === expectedPassword) {
    // Self-healing: Ensure admin user exists in DB
    await prisma.user.upsert({
      where: { email: 'admin@webbudget.local' },
      update: {},
      create: {
        email: 'admin@webbudget.local',
        name: 'Admin'
      }
    });

    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const session = await encrypt({ user: "admin", expiresAt });
    return { session, expiresAt };
  }
  return null;
}

export async function logout() {
  (await cookies()).set("session", "", { ...getCookieOptions(), expires: new Date(0) });
}

export async function getSession() {
  const session = (await cookies()).get("session")?.value;
  if (!session) return null;
  return await decrypt(session);
}

export async function updateSession(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  if (!session) return;

  const parsed = await decrypt(session);
  if (!parsed) return;

  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  parsed.expiresAt = expiresAt;
  const res = NextResponse.next();

  res.cookies.set({
    name: "session",
    value: await encrypt(parsed),
    ...getCookieOptions(),
    expires: new Date(expiresAt),
  });
  return res;
}
