import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildAcceptInviteUrl, sendInviteEmail } from "@/lib/email";
import { getServerSupabase } from "@/lib/serverSupabase";
import { generateInviteToken, hashInviteToken } from "@/lib/inviteToken";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pending_invites")
    .select("id, email, expires_at, created_at, created_by")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invites: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const { data: existingUser } = await supabase.from("app_users").select("id").eq("email", email).maybeSingle();
    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }

    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

    const { data: row, error } = await supabase
      .from("pending_invites")
      .upsert(
        {
          email,
          token_hash: tokenHash,
          expires_at: expiresAt,
          created_by: user.username,
        },
        { onConflict: "email" },
      )
      .select("id, email, expires_at, created_at, created_by")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row?.id) return NextResponse.json({ error: "Failed to save invite" }, { status: 500 });

    try {
      await sendInviteEmail(email, buildAcceptInviteUrl(token));
    } catch (e) {
      await supabase.from("pending_invites").delete().eq("id", row.id);
      const msg = (e as Error).message;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    return NextResponse.json({ invite: row });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
