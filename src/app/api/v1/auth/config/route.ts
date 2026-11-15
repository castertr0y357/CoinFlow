import { NextResponse } from "next/server";
import { isOidcEnabled } from "@/lib/oidc";

export async function GET() {
  return NextResponse.json({
    oidcEnabled: isOidcEnabled(),
    oidcLoginUrl: "/api/v1/auth/oidc/login",
  });
}
