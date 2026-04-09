import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { authCookieName, getSessionUser, sessionCookieOptions, sessionCookieValue } from "@/lib/auth";
import { getServerSupabase } from "@/lib/serverSupabase";

type Body = {
  currentPassword?: string;
  newUsername?: string;
  newPassword?: string;
};

export async function PATCH(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currentPassword = String(body.currentPassword || "");
  const newUsernameRaw = body.newUsername !== undefined ? String(body.newUsername).trim().toLowerCase() : "";
  const newPassword = body.newPassword !== undefined ? String(body.newPassword) : "";

  if (!currentPassword) {
    return NextResponse.json({ error: "Current password is required." }, { status: 400 });
  }

  const hasUsernameChange = newUsernameRaw.length > 0;
  const hasPasswordChange = newPassword.length > 0;
  if (!hasUsernameChange && !hasPasswordChange) {
    return NextResponse.json({ error: "Provide a new username and/or new password." }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data: row, error: findErr } = await supabase.from("app_users").select("*").eq("username", sessionUser.username).maybeSingle();

  if (findErr || !row) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  if ((row as { auth_user_id?: string | null }).auth_user_id) {
    return NextResponse.json(
      { error: "This account uses Google sign-in. Use your Google account to manage security." },
      { status: 403 },
    );
  }

  const pwOk = await bcrypt.compare(currentPassword, row.password_hash as string);
  if (!pwOk) return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });

  const updates: Record<string, unknown> = {};

  if (hasUsernameChange) {
    if (!newUsernameRaw || newUsernameRaw.length < 2 || newUsernameRaw.length > 64) {
      return NextResponse.json({ error: "Username must be between 2 and 64 characters." }, { status: 400 });
    }
    if (newUsernameRaw === sessionUser.username) {
      return NextResponse.json({ error: "That is already your username." }, { status: 400 });
    }
    const { data: taken } = await supabase.from("app_users").select("id").eq("username", newUsernameRaw).maybeSingle();
    if (taken) return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    updates.username = newUsernameRaw;
  }

  if (hasPasswordChange) {
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters." }, { status: 400 });
    }
    updates.password_hash = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error: updErr } = await supabase.from("app_users").update(updates).eq("id", row.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  const finalUsername = (updates.username as string | undefined) ?? sessionUser.username;
  const role = row.role as "admin" | "member";

  const details: string[] = [];
  if (updates.username) details.push(`username ${sessionUser.username} → ${updates.username}`);
  if (updates.password_hash) details.push("password changed");
  await supabase.from("audit_logs").insert({
    performed_by: finalUsername,
    action: "UPDATE_PROFILE",
    details: details.join("; "),
  });

  const sessionPayload = { username: finalUsername, role };
  const res = NextResponse.json({ user: sessionPayload });

  if (updates.username) {
    res.cookies.set(authCookieName, sessionCookieValue(sessionPayload), sessionCookieOptions());
  }

  return res;
}
