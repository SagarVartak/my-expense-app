import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // pending | approved | rejected | empty=all
    const supabase = getServerSupabase();

    let q = supabase
      .from("cost_design_change_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(150);

    if (user.role !== "admin") {
      q = q.eq("requested_by", user.username);
    }
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      q = q.eq("status", status);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ requests: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
