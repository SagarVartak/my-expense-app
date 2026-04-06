import { NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/auditLog";
import { getSessionUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const supabase = getServerSupabase();
    const { data: row, error: fetchErr } = await supabase
      .from("cost_designs")
      .select("id, created_by, keychain_design, total_cost_price")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (user.role !== "admin" && row.created_by !== user.username) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await supabase.from("cost_designs").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
    const total = Number(row.total_cost_price);
    const name = String(row.keychain_design ?? "").trim() || "(unnamed)";
    await insertAuditLog(
      user.username,
      "DELETE_COST_DESIGN",
      `Deleted cost design "${name}" (total ₹${money(total)})`,
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
