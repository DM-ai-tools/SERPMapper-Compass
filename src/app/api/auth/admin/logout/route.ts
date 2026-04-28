import { NextRequest, NextResponse } from "next/server";

const ADMIN_AUTH_COOKIE = "serp_admin_auth";

export async function POST(req: NextRequest) {
  const res = new NextResponse(null, {
    status: 303,
    headers: { Location: "/login" },
  });
  res.cookies.set(ADMIN_AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
