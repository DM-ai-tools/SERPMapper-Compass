import { NextRequest, NextResponse } from "next/server";

const ADMIN_USER_ID = process.env.ADMIN_USER_ID ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const ADMIN_AUTH_COOKIE = "serp_admin_auth";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { userId?: string; password?: string };
    const userId = (body.userId ?? "").trim();
    const password = body.password ?? "";

    if (!ADMIN_USER_ID || !ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Admin credentials are not configured." },
        { status: 503 }
      );
    }

    if (!userId || !password) {
      return NextResponse.json(
        { error: "User ID and password are required." },
        { status: 400 }
      );
    }

    if (userId !== ADMIN_USER_ID || password !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Invalid admin user ID or password." },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(ADMIN_AUTH_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json(
      { error: "Invalid request payload." },
      { status: 400 }
    );
  }
}
