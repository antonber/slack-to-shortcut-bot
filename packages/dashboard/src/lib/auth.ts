import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "mc_auth";

/** Validates the request against DASHBOARD_API_KEY. Returns null if OK, or an error response. */
export function checkAuth(request: NextRequest): NextResponse | null {
  const apiKey = process.env.DASHBOARD_API_KEY;
  if (!apiKey) return null; // No key configured = dev mode, allow all

  const authHeader = request.headers.get("authorization");
  const queryKey = request.nextUrl.searchParams.get("key");
  const cookieKey = request.cookies.get(COOKIE_NAME)?.value;

  if (authHeader === `Bearer ${apiKey}` || queryKey === apiKey) {
    // Authorized — set a session cookie so nav links work without ?key=
    if (queryKey) {
      const url = new URL(request.url);
      url.searchParams.delete("key");
      const response = NextResponse.redirect(url);
      response.cookies.set(COOKIE_NAME, apiKey, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
      });
      return response;
    }
    return null;
  }

  if (cookieKey === apiKey) {
    return null; // Authorized via cookie
  }

  return new NextResponse("Unauthorized", { status: 401 });
}
