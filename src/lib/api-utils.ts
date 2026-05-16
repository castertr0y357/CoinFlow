import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "./services/auth";

import { cookies } from "next/headers";
import { decrypt } from "./auth";
import prisma from "./prisma";

export async function withAuth(req: NextRequest, handler: (user: any) => Promise<NextResponse>) {
  try {
    // 1. Check for API Key (External/Background access)
    // 1. Check for API Key (External/Background access)
    const apiKey = req.headers.get("X-API-KEY");
    if (apiKey) {
      const user = await validateApiKey(apiKey);
      if (user) return addCorsHeaders(await handler(user));
    }

    // 2. Check for Session Cookie (Dashboard/Browser access)
    const session = (await cookies()).get("session")?.value;
    if (session) {
      const parsed = await decrypt(session);
      if (parsed) {
        // For this app, we assume the session belongs to the admin user
        const user = await prisma.user.findUnique({ 
          where: { email: 'admin@webbudget.local' } 
        });
        if (user) {
          return addCorsHeaders(await handler(user));
        } else {
          console.log(`[AUTH] Valid session but User 'admin@webbudget.local' not found in DB!`);
        }
      } else {
        console.log(`[AUTH] Session cookie decryption failed.`);
      }
    }

    console.log(`[AUTH] Unauthorized API access to ${req.nextUrl.pathname}. Session Present: ${!!(await cookies()).get("session")?.value}`);
    return addCorsHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  } catch (error: any) {
    console.error(`API Error [${req.nextUrl.pathname}]:`, error);
    return addCorsHeaders(NextResponse.json(
      { error: "Internal server error", details: error.message }, 
      { status: 500 }
    ));
  }
}

function addCorsHeaders(res: NextResponse): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, X-API-KEY, Authorization");
  return res;
}

