import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/serverSupabase";

/** Active app users (usernames) for Paid By dropdowns — any logged-in user. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("app_users")
      .select("username")
      .eq("active", true)
      .order("username", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const names = (data ?? []).map((r: { username: string }) => r.username);
    return NextResponse.json({ names });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
