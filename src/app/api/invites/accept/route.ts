import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getServerSupabase } from "@/lib/serverSupabase";
import { hashInviteToken } from "@/lib/inviteToken";

function usernameFromEmail(email: string): string {
  const local = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "") || "user";
  return local.slice(0, 28) || "user";
}

/** Creates a member row; sign-in is via Google only (password hash is random / unusable). */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = String(body.token || "").trim();
    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

    const tokenHash = hashInviteToken(token);
    const supabase = getServerSupabase();

    const { data: invite, error: invErr } = await supabase
      .from("pending_invites")
      .select("id, email, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });
    if (!invite) return NextResponse.json({ error: "Invalid invite" }, { status: 400 });

    const expires = new Date(invite.expires_at).getTime();
    if (Number.isFinite(expires) && expires < Date.now()) {
      return NextResponse.json({ error: "Invite expired" }, { status: 410 });
    }

    const email = String(invite.email).trim().toLowerCase();

    const { data: dup } = await supabase.from("app_users").select("id").eq("email", email).maybeSingle();
    if (dup) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    let base = usernameFromEmail(email);
    let username = base;
    for (let attempt = 0; attempt < 25; attempt++) {
      const { data: exists } = await supabase.from("app_users").select("id").eq("username", username).maybeSingle();
      if (!exists) break;
      username = `${base.slice(0, 20)}_${randomBytes(3).toString("hex")}`;
    }

    const password_hash = await bcrypt.hash(randomBytes(48).toString("hex"), 10);
    const now = new Date().toISOString();

    const { data: created, error: createErr } = await supabase
      .from("app_users")
      .insert({
        username,
        email,
        email_verified_at: now,
        role: "member",
        active: true,
        password_hash,
      })
      .select("username, role")
      .single();

    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 500 });

    await supabase.from("pending_invites").delete().eq("id", invite.id);

    return NextResponse.json({ ok: true, user: created });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
