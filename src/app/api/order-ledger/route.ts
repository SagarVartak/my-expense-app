import { NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/auditLog";
import { getSessionUser } from "@/lib/auth";
import { notifyDiscordOrderLedgerAdded } from "@/lib/discordWebhook";
import { generateOrderUid } from "@/lib/entryUid";
import { getServerSupabase } from "@/lib/serverSupabase";

function num(v: unknown, def = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : def;
}

/** PostgREST when column missing or cache stale */
function isMissingExcludeShippingColumnError(err: unknown): boolean {
  const msg = String((err as { message?: string; code?: string })?.message ?? "");
  const code = String((err as { code?: string })?.code ?? "");
  return (
    /exclude_shipping_from_cost|schema cache|could not find.*column/i.test(msg) ||
    code === "PGRST204"
  );
}

type OrderInsertRow = Record<string, unknown>;

async function insertOrderLedgerWithFallback(
  supabase: ReturnType<typeof getServerSupabase>,
  row: OrderInsertRow,
): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
  let { data, error } = await supabase.from("order_ledger").insert(row).select("*").single();
  if (!error) return { data, error: null };

  if (isMissingExcludeShippingColumnError(error) && "exclude_shipping_from_cost" in row) {
    const { exclude_shipping_from_cost: _e, ...withoutFlag } = row;
    const retry = await supabase.from("order_ledger").insert(withoutFlag).select("*").single();
    return { data: retry.data as Record<string, unknown> | null, error: retry.error };
  }

  const dup =
    (error as { code?: string }).code === "23505" ||
    Boolean((error as { message?: string }).message?.match?.(/duplicate|unique/i));
  if (dup) {
    const retry = await supabase
      .from("order_ledger")
      .insert({ ...row, order_uid: generateOrderUid() })
      .select("*")
      .single();
    if (!retry.error) return { data: retry.data as Record<string, unknown> | null, error: null };
    if (isMissingExcludeShippingColumnError(retry.error) && "exclude_shipping_from_cost" in row) {
      const { exclude_shipping_from_cost: _e, ...withoutFlag } = row;
      const retry2 = await supabase
        .from("order_ledger")
        .insert({ ...withoutFlag, order_uid: generateOrderUid() })
        .select("*")
        .single();
      return { data: retry2.data as Record<string, unknown> | null, error: retry2.error };
    }
    return { data: retry.data as Record<string, unknown> | null, error: retry.error };
  }

  return { data, error };
}

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
    return NextResponse.json({ orders: data ?? [] });
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

    const row = {
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
    };

    const inserted = await insertOrderLedgerWithFallback(supabase, row);
    const { data, error } = inserted;
    if (error) return NextResponse.json({ error: String((error as { message?: string }).message ?? error) }, { status: 500 });

    const orderOut = data
      ? {
          ...data,
          exclude_shipping_from_cost:
            typeof data.exclude_shipping_from_cost === "boolean"
              ? data.exclude_shipping_from_cost
              : exclude_shipping_from_cost,
        }
      : data;

    const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
    const shipNote = exclude_shipping_from_cost ? ` — shipping fee (${money(designShipping)}) excluded from cost` : "";
    await insertAuditLog(
      user.username,
      "ADD_ORDER_LEDGER",
      `Order ${(orderOut as { order_uid?: string })?.order_uid ?? ""} — ${customer_name} — design "${row.design_name}" — sell ₹${money(selling_price)} — cost ₹${money(total_cost_price)} — net ₹${money(net_profit)} — payment ${row.payment_method} (${row.payment_status}) — delivery ${row.delivery_status}${shipNote}`,
    );

    if (orderOut) notifyDiscordOrderLedgerAdded(orderOut as Parameters<typeof notifyDiscordOrderLedgerAdded>[0], user.username);

    return NextResponse.json({ order: orderOut });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
