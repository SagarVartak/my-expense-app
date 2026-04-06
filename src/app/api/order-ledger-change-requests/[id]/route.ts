import { NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/auditLog";
import { getSessionUser } from "@/lib/auth";
import { orderSnapshotToUpdateRow } from "@/lib/orderLedgerSnapshots";
import { updateOrderLedgerWithSchemaFallback } from "@/lib/orderLedgerSchemaFallback";
import type { OrderLedgerSnapshotJson } from "@/lib/types";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const body = await req.json();
    const action = String(body.action ?? "").trim();
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action must be approve or reject." }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: reqRow, error: fetchErr } = await supabase
      .from("order_ledger_change_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr || !reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (reqRow.status !== "pending") {
      return NextResponse.json({ error: "This request is no longer pending." }, { status: 400 });
    }

    const orderId = reqRow.order_id as string;
    const proposed_payload = reqRow.proposed_snapshot as OrderLedgerSnapshotJson;
    const previous_snapshot = reqRow.previous_snapshot as OrderLedgerSnapshotJson;

    if (action === "reject") {
      const reject_reason = String(body.reject_reason ?? "").trim();
      const { error: updErr } = await supabase
        .from("order_ledger_change_requests")
        .update({
          status: "rejected",
          reviewed_by: user.username,
          reviewed_at: new Date().toISOString(),
          reject_reason: reject_reason,
        })
        .eq("id", id);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

      await insertAuditLog(
        user.username,
        "REJECT_ORDER_EDIT",
        `Rejected order edit ${id.slice(0, 8)}… for order ${proposed_payload.order_uid}${reject_reason ? ` — ${reject_reason}` : ""}`,
      );
      return NextResponse.json({ ok: true });
    }

    const updatePayload = orderSnapshotToUpdateRow(proposed_payload);
    const { data: updated, error: applyErr } = await updateOrderLedgerWithSchemaFallback(
      supabase,
      orderId,
      updatePayload as Record<string, unknown>,
    );
    if (applyErr) return NextResponse.json({ error: String((applyErr as { message?: string }).message ?? applyErr) }, { status: 500 });

    await supabase.from("printed_inventory_entries").delete().eq("order_id", orderId);
    const cid = proposed_payload.cost_design_id;
    if (cid) {
      const u = Math.max(1, Math.floor(Number(proposed_payload.units ?? 1)));
      const { error: invErr } = await supabase.from("printed_inventory_entries").insert({
        cost_design_id: cid,
        quantity: -u,
        printer_name: `Order ${proposed_payload.order_uid}`,
        created_by: user.username,
        order_id: orderId,
      });
      if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });
    }

    const { error: reqUpdErr } = await supabase
      .from("order_ledger_change_requests")
      .update({
        status: "approved",
        reviewed_by: user.username,
        reviewed_at: new Date().toISOString(),
        reject_reason: "",
      })
      .eq("id", id);
    if (reqUpdErr) return NextResponse.json({ error: reqUpdErr.message }, { status: 500 });

    const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
    await insertAuditLog(
      user.username,
      "APPROVE_ORDER_EDIT",
      `Approved order edit for ${proposed_payload.order_uid} (requested by ${String(reqRow.requested_by)}) — total ₹${money(previous_snapshot.total_cost_price)} → ₹${money(proposed_payload.total_cost_price)}`,
    );

    return NextResponse.json({ order: updated, requestId: id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
