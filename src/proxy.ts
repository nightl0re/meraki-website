import { NextResponse, type NextRequest } from "next/server";

// Fast, optimistic check: no session cookie -> go to login. The real checks
// (valid session, correct role, ownership) happen in each page and action.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("meraki_session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/parent/:path*",
    "/sitter/:path*",
    "/admin/:path*",
    "/bookings/:path*",
    "/book/:path*",
    "/settings/:path*",
    "/notifications/:path*",
    "/favorites/:path*",
  ],
};
