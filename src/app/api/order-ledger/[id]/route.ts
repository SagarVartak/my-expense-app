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
      .from("order_ledger")
      .select("id, order_uid, customer_name, design_name, created_by, approval_status")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role !== "admin") {
      return NextResponse.json(
        { error: "Members must submit a deletion request. An admin will approve it under Approvals → Deletions." },
        { status: 403 },
      );
    }

    const { error } = await supabase.from("order_ledger").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const design = String(row.design_name ?? "").trim() || "—";
    await insertAuditLog(
      user.username,
      "DELETE_ORDER_LEDGER",
      `Deleted order ${row.order_uid} — ${row.customer_name} — design "${design}"`,
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
