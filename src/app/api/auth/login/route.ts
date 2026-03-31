import { NextResponse } from "next/server";
import { authenticate, authCookieName, sessionCookieOptions, sessionCookieValue } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { username, password } = (await req.json()) as { username?: string; password?: string };
    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    const user = await authenticate(username.trim(), password);
    if (!user) return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });

    const res = NextResponse.json({ user });
    res.cookies.set(authCookieName, sessionCookieValue(user), sessionCookieOptions());
    return res;
  } catch {
    return NextResponse.json({ error: "Login failed. Check Supabase env vars and app_users table." }, { status: 500 });
  }
}

