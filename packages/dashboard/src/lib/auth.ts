import { NextRequest, NextResponse } from "next/server";

/** Validates the request against DASHBOARD_API_KEY. Returns null if OK, or an error response. */
export function checkAuth(request: NextRequest): NextResponse | null {
  const apiKey = process.env.DASHBOARD_API_KEY;
  if (!apiKey) return null; // No key configured = dev mode, allow all

  const authHeader = request.headers.get("authorization");
  const queryKey = request.nextUrl.searchParams.get("key");

  if (authHeader === `Bearer ${apiKey}` || queryKey === apiKey) {
    return null; // Authorized
  }

  return new NextResponse("Unauthorized", { status: 401 });
}
