import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "serp_auth";
const ADMIN_AUTH_COOKIE = "serp_admin_auth";
const ADMIN_USER_ID = process.env.ADMIN_USER_ID ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublicAsset = /\.[a-zA-Z0-9]+$/.test(pathname);

  // Always allow framework assets and auth endpoints.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/favicon.ico" ||
    isPublicAsset
  ) {
    return NextResponse.next();
  }

  // Leave non-auth APIs open to avoid breaking client calls.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!ADMIN_USER_ID || !ADMIN_PASSWORD) {
      return new NextResponse("Admin credentials are not configured.", { status: 503 });
    }
    const hasAdminSession = req.cookies.get(ADMIN_AUTH_COOKIE)?.value === "1";
    if (pathname === "/admin/login") {
      if (hasAdminSession) {
        const url = req.nextUrl.clone();
        url.pathname = "/admin";
        return NextResponse.redirect(url);
      }
      return NextResponse.next();
    }
    if (!hasAdminSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const hasSession = req.cookies.get(AUTH_COOKIE)?.value === "1";

  if (!hasSession && pathname !== "/login" && pathname !== "/signup") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (hasSession && (pathname === "/login" || pathname === "/signup")) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
