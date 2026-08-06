import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = getServerSupabase();
    let q = supabase.from("order_ledger_change_requests").select("*").order("created_at", { ascending: false }).limit(150);

    if (!["admin", "manager"].includes(user.role)) {
      q = q.eq("requested_by", user.username);
    }

    const { data, error } = await q;
    if (error) {
      if (/order_ledger_change_requests|relation|does not exist/i.test(error.message)) {
        return NextResponse.json({ requests: [] });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ requests: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
