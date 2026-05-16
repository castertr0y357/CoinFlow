import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SECRET = new TextEncoder().encode(
  process.env.APP_PASSWORD || "change-this-default-password-12345"
);

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function decrypt(input: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(input, SECRET, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (e) {
    return null;
  }
}

export async function login(password: string) {
  const expectedPassword = process.env.APP_PASSWORD || "admin";
  console.log(`[AUTH] Login attempt. Password provided: "${password}", Expected: "${expectedPassword}"`);
  
  if (password === expectedPassword) {
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const session = await encrypt({ user: "admin", expires });

    const isProduction = process.env.NODE_ENV === "production";
    const secureOverride = process.env.SECURE_COOKIES;
    const secure = secureOverride === "true" ? true : (secureOverride === "false" ? false : isProduction);

    (await cookies()).set("session", session, { 
      expires, 
      httpOnly: true, 
      secure, 
      sameSite: "lax",
      path: "/",
    });
    return true;
  }
  return false;
}

export async function logout() {
  (await cookies()).set("session", "", { expires: new Date(0) });
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

  parsed.expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const res = NextResponse.next();
  const isProduction = process.env.NODE_ENV === "production";
  const secureOverride = process.env.SECURE_COOKIES;
  const secure = secureOverride === "true" ? true : (secureOverride === "false" ? false : isProduction);

  res.cookies.set({
    name: "session",
    value: await encrypt(parsed),
    httpOnly: true,
    expires: parsed.expires,
    secure,
    sameSite: "lax",
    path: "/",
  });
  return res;
}
