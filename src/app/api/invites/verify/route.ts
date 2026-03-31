import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/serverSupabase";
import { hashInviteToken } from "@/lib/inviteToken";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ valid: false, error: "Missing token" });

  const tokenHash = hashInviteToken(token);
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pending_invites")
    .select("email, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) return NextResponse.json({ valid: false, error: error.message });
  if (!data) return NextResponse.json({ valid: false, error: "Invalid or expired invite" });

  const expires = new Date(data.expires_at).getTime();
  if (Number.isFinite(expires) && expires < Date.now()) {
    return NextResponse.json({ valid: false, error: "Invite expired" });
  }

  return NextResponse.json({ valid: true, email: data.email });
}
