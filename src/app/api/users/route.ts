import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSessionUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, username, role, active, created_at, email, email_verified_at, auth_user_id")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const username = String(body.username || "").trim().toLowerCase();
  const emailRaw = String(body.email || "").trim().toLowerCase();
  const role = body.role === "admin" ? "admin" : body.role === "manager" ? "manager" : "member";

  if (!username) {
    return NextResponse.json({ error: "Username is required." }, { status: 400 });
  }
  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json(
      { error: "Provide a valid Google email that matches the user’s Google account (admins and members sign in with Google)." },
      { status: 400 },
    );
  }

  const password_hash = await bcrypt.hash(randomBytes(48).toString("hex"), 10);

  const supabase = getServerSupabase();
  const insert: Record<string, unknown> = {
    username,
    role,
    active: true,
    password_hash,
    email: emailRaw,
    email_verified_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("app_users")
    .insert(insert)
    .select("id, username, role, active, created_at, email, email_verified_at, auth_user_id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}
