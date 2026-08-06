import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const cost_design_id = searchParams.get("cost_design_id");
    if (!cost_design_id) {
      return NextResponse.json({ error: "cost_design_id is required" }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const { data: entries, error } = await supabase
      .from("printed_inventory_entries")
      .select("id, cost_design_id, quantity, printer_name, created_by, created_at, order_id")
      .eq("cost_design_id", cost_design_id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ entries: entries ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}