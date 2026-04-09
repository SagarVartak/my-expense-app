import { NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/auditLog";
import { getSessionUser } from "@/lib/auth";
import { appBaseUrl } from "@/lib/email";
import { notifyAdminsPendingApproval } from "@/lib/notifyAdmins";
import { orderSnapshotFromRow } from "@/lib/orderLedgerSnapshots";
import { getServerSupabase } from "@/lib/serverSupabase";

function num(v: unknown, def = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : def;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: orderId } = await params;
  if (!orderId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const body = await req.json();
    const supabase = getServerSupabase();

    const { data: orderRow, error: oErr } = await supabase.from("order_ledger").select("*").eq("id", orderId).maybeSingle();
    if (oErr || !orderRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const approval = String((orderRow as { approval_status?: string }).approval_status ?? "approved");
    if (approval !== "approved") {
      return NextResponse.json(
        { error: "Only approved orders can be edited. Wait for approval or reject of this order first." },
        { status: 400 },
      );
    }

    const { data: pending, error: pErr } = await supabase
      .from("order_ledger_change_requests")
      .select("id")
      .eq("order_id", orderId)
      .eq("status", "pending")
      .maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (pending) {
      return NextResponse.json(
        { error: "A pending edit request already exists for this order. Wait for an admin to review it." },
        { status: 409 },
      );
    }

    const cost_design_id = String(body.cost_design_id ?? "").trim();
    if (!cost_design_id) return NextResponse.json({ error: "Select a saved design." }, { status: 400 });

    const order_date = String(body.order_date ?? "").trim();
    if (!order_date) return NextResponse.json({ error: "Order date is required." }, { status: 400 });

    const customer_name = String(body.customer_name ?? "").trim();
    if (!customer_name) return NextResponse.json({ error: "Customer name is required." }, { status: 400 });

    const { data: design, error: designErr } = await supabase
      .from("cost_designs")
      .select("id, keychain_design, total_cost_price, shipping")
      .eq("id", cost_design_id)
      .maybeSingle();
    if (designErr || !design) return NextResponse.json({ error: "Selected design was not found." }, { status: 400 });

    const designTotal = num(design.total_cost_price);
    const designShipping = num(design.shipping);
    const exclude_shipping_from_cost = Boolean(body.exclude_shipping_from_cost);
    const total_cost_price = exclude_shipping_from_cost
      ? Math.max(0, designTotal - designShipping)
      : designTotal;
    const selling_price = num(body.selling_price);
    const net_profit = selling_price - total_cost_price;
    const units = Math.max(1, Math.floor(num(body.units, 1)));

    const proposed_snapshot = {
      order_uid: String((orderRow as { order_uid?: string }).order_uid ?? ""),
      order_date,
      cost_design_id: design.id as string,
      design_name: String(design.keychain_design ?? ""),
      customer_name,
      shipping_address: String(body.shipping_address ?? "").trim(),
      actual_weight_g: num(body.actual_weight_g),
      total_cost_price,
      selling_price,
      net_profit,
      payment_method: String(body.payment_method ?? "").trim() || "Other",
      payment_status: String(body.payment_status ?? "").trim() || "Pending",
      delivery_status: String(body.delivery_status ?? "").trim() || "Pending",
      source: String(body.source ?? "").trim(),
      feedback: String(body.feedback ?? "").trim(),
      customer_behaviour: String(body.customer_behaviour ?? "").trim(),
      exclude_shipping_from_cost,
      units,
    };

    const previous_snapshot = orderSnapshotFromRow(orderRow as Record<string, unknown>);

    const { data: created, error: insErr } = await supabase
      .from("order_ledger_change_requests")
      .insert({
        order_id: orderId,
        status: "pending",
        requested_by: user.username,
        previous_snapshot,
        proposed_snapshot,
      })
      .select("*")
      .single();

    if (insErr) {
      if (/order_ledger_change_requests|relation|does not exist/i.test(insErr.message)) {
        return NextResponse.json(
          { error: "Run migration_order_ledger_change_requests.sql on your database." },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
    await insertAuditLog(
      user.username,
      "SUBMIT_ORDER_EDIT_REQUEST",
      `Edit request for order ${proposed_snapshot.order_uid} — total ₹${money(previous_snapshot.total_cost_price)} → ₹${money(proposed_snapshot.total_cost_price)} (pending approval)`,
    );

    if (user.role !== "admin") {
      const open = `${appBaseUrl()}/?nav=orderApprovals`;
      void notifyAdminsPendingApproval({
        subject: `Order edit pending: ${proposed_snapshot.order_uid}`,
        htmlBody: `<p><strong>${user.username}</strong> requested changes to order <strong>${proposed_snapshot.order_uid}</strong> (${proposed_snapshot.customer_name}).</p><p>Total cost: ₹${money(previous_snapshot.total_cost_price)} → ₹${money(proposed_snapshot.total_cost_price)}.</p><p><a href="${open}">Open Order approvals</a></p>`,
        openPath: "/?nav=orderApprovals",
      }).catch(() => {});
    }

    return NextResponse.json({ request: created });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
