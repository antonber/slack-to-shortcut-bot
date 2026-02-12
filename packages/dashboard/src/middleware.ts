import { NextRequest, NextResponse } from "next/server";
import { checkAuth } from "@/lib/auth";

export function middleware(request: NextRequest) {
  const authResult = checkAuth(request);
  if (authResult) return authResult;
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
