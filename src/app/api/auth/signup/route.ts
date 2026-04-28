import { NextRequest, NextResponse } from "next/server";
import { ensureDatabaseReady } from "@/lib/db";
import {
  createAuthUser,
  ensureAuthUsersTable,
  normaliseEmail,
} from "@/lib/auth-users";

const AUTH_COOKIE = "serp_auth";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      email?: string;
      password?: string;
      confirmPassword?: string;
    };

    const email = normaliseEmail(body.email ?? "");
    const password = body.password ?? "";
    const confirmPassword = body.confirmPassword ?? "";

    if (!email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "Email, password, and confirm password are required." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Password and confirm password do not match." },
        { status: 400 }
      );
    }

    await ensureDatabaseReady();
    await ensureAuthUsersTable();

    const created = await createAuthUser(email, password);
    if (created === "exists") {
      return NextResponse.json(
        { error: "User already exists." },
        { status: 409 }
      );
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(AUTH_COOKIE, "1", {
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
