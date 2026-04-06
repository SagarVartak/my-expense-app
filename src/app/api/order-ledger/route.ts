import { NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/auditLog";
import { getSessionUser } from "@/lib/auth";
import { notifyDiscordOrderLedgerAdded } from "@/lib/discordWebhook";
import { generateOrderUid } from "@/lib/entryUid";
import { insertOrderLedgerWithSchemaFallback } from "@/lib/orderLedgerSchemaFallback";
import { getServerSupabase } from "@/lib/serverSupabase";

function num(v: unknown, def = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : def;
}

type OrderInsertRow = Record<string, unknown>;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from("order_ledger")
      .select("*")
      .order("order_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []) as Record<string, unknown>[];
    if (user.role === "admin") {
      return NextResponse.json({ orders: rows });
    }

    const filtered = rows.filter((o) => {
      const st = String(o.approval_status ?? "approved");
      if (st === "approved") return true;
      if (o.created_by === user.username && (st === "pending" || st === "rejected")) return true;
      return false;
    });
    return NextResponse.json({ orders: filtered });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const cost_design_id = String(body.cost_design_id ?? "").trim();
    if (!cost_design_id) {
      return NextResponse.json({ error: "Select a saved design." }, { status: 400 });
    }

    const order_date = String(body.order_date ?? "").trim();
    if (!order_date) return NextResponse.json({ error: "Order date is required." }, { status: 400 });

    const customer_name = String(body.customer_name ?? "").trim();
    if (!customer_name) return NextResponse.json({ error: "Customer name is required." }, { status: 400 });

    const supabase = getServerSupabase();
    const { data: design, error: designErr } = await supabase
      .from("cost_designs")
      .select("id, keychain_design, total_cost_price, shipping")
      .eq("id", cost_design_id)
      .maybeSingle();
    if (designErr || !design) {
      return NextResponse.json({ error: "Selected design was not found." }, { status: 400 });
    }

    const designTotal = num(design.total_cost_price);
    const designShipping = num(design.shipping);
    const exclude_shipping_from_cost = Boolean(body.exclude_shipping_from_cost);
    const total_cost_price = exclude_shipping_from_cost
      ? Math.max(0, designTotal - designShipping)
      : designTotal;
    const selling_price = num(body.selling_price);
    const net_profit = selling_price - total_cost_price;
    const units = Math.max(1, Math.floor(num(body.units, 1)));

    const row: OrderInsertRow = {
      order_uid: generateOrderUid(),
      order_date,
      cost_design_id: design.id,
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
      created_by: user.username,
      approval_status: "pending",
      units,
    };

    const inserted = await insertOrderLedgerWithSchemaFallback(supabase, row, generateOrderUid);
    const { data, error } = inserted;
    if (error) return NextResponse.json({ error: String((error as { message?: string }).message ?? error) }, { status: 500 });

    const exclude_shipping_from_cost_eff = Boolean(body.exclude_shipping_from_cost);
    const orderOut = data
      ? {
          ...data,
          exclude_shipping_from_cost:
            typeof data.exclude_shipping_from_cost === "boolean"
              ? data.exclude_shipping_from_cost
              : exclude_shipping_from_cost_eff,
          approval_status: (data as { approval_status?: string }).approval_status ?? "pending",
        }
      : data;

    const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
    const shipNote = exclude_shipping_from_cost ? ` — shipping fee (${money(designShipping)}) excluded from cost` : "";
    await insertAuditLog(
      user.username,
      "SUBMIT_ORDER_LEDGER",
      `Order ${(orderOut as { order_uid?: string })?.order_uid ?? ""} — ${customer_name} — design "${row.design_name}" — sell ₹${money(selling_price)} — cost ₹${money(total_cost_price)} — net ₹${money(net_profit)} — payment ${row.payment_method} (${row.payment_status}) — delivery ${row.delivery_status}${shipNote} — pending admin approval`,
    );

    return NextResponse.json({ order: orderOut });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
