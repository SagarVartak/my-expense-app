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

    // Handle new items array format
    const items = body.items as Array<{
      cost_design_id: string;
      quantity: number;
      unit_selling_price: number;
    }> | undefined;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "At least one order item is required." }, { status: 400 });
    }

    const order_date = String(body.order_date ?? "").trim();
    if (!order_date) return NextResponse.json({ error: "Order date is required." }, { status: 400 });

    const customer_name = String(body.customer_name ?? "").trim();
    if (!customer_name) return NextResponse.json({ error: "Customer name is required." }, { status: 400 });

    // Validate all items have valid designs
    const designIds = items.map((i) => i.cost_design_id).filter(Boolean);
    const { data: designs, error: designsErr } = await supabase
      .from("cost_designs")
      .select("id, keychain_design, total_cost_price, shipping")
      .in("id", designIds);

    if (designsErr) return NextResponse.json({ error: designsErr.message }, { status: 500 });

    const designMap = new Map((designs ?? []).map((d) => [d.id as string, d]));
    const exclude_shipping_from_cost = Boolean(body.exclude_shipping_from_cost);

    // Calculate totals and prepare items
    let grandTotalCost = 0;
    let grandTotalSelling = 0;
    const proposedItems = items.map((item) => {
      const design = designMap.get(item.cost_design_id);
      if (!design) throw new Error(`Design ${item.cost_design_id} not found`);

      const designTotal = num(design.total_cost_price);
      const designShipping = num(design.shipping);
      const unitCostPrice = exclude_shipping_from_cost
        ? Math.max(0, designTotal - designShipping)
        : designTotal;
      const unitSellingPrice = num(item.unit_selling_price);
      const quantity = Math.max(1, Math.floor(num(item.quantity, 1)));

      grandTotalCost += unitCostPrice * quantity;
      grandTotalSelling += unitSellingPrice * quantity;

      return {
        cost_design_id: item.cost_design_id,
        design_name: design.keychain_design,
        quantity,
        unit_cost_price: unitCostPrice,
        unit_selling_price: unitSellingPrice,
      };
    });

    const net_profit = grandTotalSelling - grandTotalCost;

    // Build proposed snapshot with items
    const proposed_snapshot = {
      order_uid: String((orderRow as { order_uid?: string }).order_uid ?? ""),
      order_date,
      customer_name,
      customer_phone: String(body.customer_phone ?? "").trim(),
      shipment_tracking: String(body.shipment_tracking ?? "").trim(),
      shipping_address: String(body.shipping_address ?? "").trim(),
      actual_weight_g: num(body.actual_weight_g),
      total_cost_price: grandTotalCost,
      selling_price: grandTotalSelling,
      net_profit,
      payment_method: String(body.payment_method ?? "").trim() || "Other",
      payment_status: String(body.payment_status ?? "").trim() || "Pending",
      delivery_status: String(body.delivery_status ?? "").trim() || "Pending",
      source: String(body.source ?? "").trim(),
      feedback: String(body.feedback ?? "").trim(),
      customer_behaviour: String(body.customer_behaviour ?? "").trim(),
      exclude_shipping_from_cost,
      items: proposedItems,
      // Legacy fields for backward compatibility
      cost_design_id: proposedItems[0]?.cost_design_id || null,
      design_name: proposedItems[0]?.design_name || "",
      units: proposedItems[0]?.quantity || 1,
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
    const itemsDesc = proposedItems.map((i) => `${i.design_name} ×${i.quantity}`).join(", ");
    await insertAuditLog(
      user.username,
      "SUBMIT_ORDER_EDIT_REQUEST",
      `Edit request for order ${proposed_snapshot.order_uid} — items: ${itemsDesc} — total ₹${money(previous_snapshot.total_cost_price)} → ₹${money(proposed_snapshot.total_cost_price)} (pending approval)`,
    );

    if (user.role !== "admin") {
      const open = `${appBaseUrl()}/?nav=orderApprovals`;
      void notifyAdminsPendingApproval({
        subject: `Order edit pending: ${proposed_snapshot.order_uid}`,
        htmlBody: `<p><strong>${user.username}</strong> requested changes to order <strong>${proposed_snapshot.order_uid}</strong> (${proposed_snapshot.customer_name}).</p><p>Items: ${itemsDesc}</p><p>Total cost: ₹${money(previous_snapshot.total_cost_price)} → ₹${money(proposed_snapshot.total_cost_price)}.</p><p><a href="${open}">Open Order approvals</a></p>`,
        kind: "order_edit",
        nav: "orderApprovals",
      }).catch(() => {});
    }

    return NextResponse.json({ request: created });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}