import { NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/auditLog";
import { getSessionUser } from "@/lib/auth";
import { appBaseUrl } from "@/lib/email";
import { notifyAdminsPendingApproval } from "@/lib/notifyAdmins";
import { generateOrderUid } from "@/lib/entryUid";
import { insertOrderLedgerWithSchemaFallback } from "@/lib/orderLedgerSchemaFallback";
import { getServerSupabase } from "@/lib/serverSupabase";

function num(v: unknown, def = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : def;
}

type OrderInsertRow = Record<string, unknown>;

async function fetchOrdersWithItems(supabase: ReturnType<typeof getServerSupabase>, userRole: string, username: string) {
  // First fetch all orders
  const { data: ordersData, error: ordersError } = await supabase
    .from("order_ledger")
    .select("*")
    .order("order_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (ordersError) return { orders: null, error: ordersError };

  const orderRows = (ordersData ?? []) as Record<string, unknown>[];

  // Filter based on user role
  const isAdminOrManager = userRole === "admin" || userRole === "manager";
  const filteredOrders = isAdminOrManager
    ? orderRows
    : orderRows.filter((o) => {
        const st = String(o.approval_status ?? "approved");
        if (st === "approved") return true;
        if (o.created_by === username && (st === "pending" || st === "rejected")) return true;
        return false;
      });

  // Fetch items for these orders
  const orderIds = filteredOrders.map((o) => o.id as string);
  let itemsMap = new Map<string, unknown[]>();

  if (orderIds.length > 0) {
    const { data: itemsData, error: itemsError } = await supabase
      .from("order_ledger_items")
      .select(`
        *,
        cost_designs!inner (
          keychain_design
        )
      `)
      .in("order_id", orderIds);

    if (!itemsError && itemsData) {
      for (const item of itemsData) {
        const orderId = item.order_id as string;
        if (!itemsMap.has(orderId)) itemsMap.set(orderId, []);
        // Include keychain_design from joined cost_designs
        const costDesigns = (item as Record<string, unknown>).cost_designs as { keychain_design?: string } | unknown;
        const itemWithDesign = {
          ...item,
          keychain_design: (costDesigns as { keychain_design?: string })?.keychain_design ?? "",
        };
        itemsMap.get(orderId)!.push(itemWithDesign);
      }
    }
  }

  // Merge items into orders
  const ordersWithItems = filteredOrders.map((order) => ({
    ...order,
    items: itemsMap.get(order.id as string) || [],
  }));

  return { orders: ordersWithItems, error: null };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = getServerSupabase();
    const { orders, error } = await fetchOrdersWithItems(supabase, user.role, user.username);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ orders: orders ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const order_date = String(body.order_date ?? "").trim();
    if (!order_date) return NextResponse.json({ error: "Order date is required." }, { status: 400 });

    const customer_name = String(body.customer_name ?? "").trim();
    if (!customer_name) return NextResponse.json({ error: "Customer name is required." }, { status: 400 });

    const items = body.items as Array<{
      cost_design_id: string;
      quantity: number;
      unit_cost_price: number;
      unit_selling_price: number;
    }> | undefined;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "At least one order item is required." }, { status: 400 });
    }

    // Validate all items have valid designs
    const supabase = getServerSupabase();
    const designIds = items.map((i) => i.cost_design_id).filter(Boolean);
    const { data: designs, error: designsErr } = await supabase
      .from("cost_designs")
      .select("id, keychain_design, total_cost_price, shipping")
      .in("id", designIds);

    if (designsErr) return NextResponse.json({ error: designsErr.message }, { status: 500 });

    const designMap = new Map((designs ?? []).map((d) => [d.id as string, d]));
    const exclude_shipping_from_cost = Boolean(body.exclude_shipping_from_cost);

    // Calculate totals
    let grandTotalCost = 0;
    let grandTotalSelling = 0;
    const orderItemsForInsert = items.map((item) => {
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
        quantity,
        unit_cost_price: unitCostPrice,
        unit_selling_price: unitSellingPrice,
      };
    });

    const net_profit = grandTotalSelling - grandTotalCost;

    // Insert order
    const row: OrderInsertRow = {
      order_uid: generateOrderUid(),
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
      created_by: user.username,
      approval_status: "pending",
      // Legacy fields for backward compatibility - use first item
      cost_design_id: orderItemsForInsert[0]?.cost_design_id || null,
      design_name: designMap.get(orderItemsForInsert[0]?.cost_design_id || "")?.keychain_design || "",
      units: orderItemsForInsert[0]?.quantity || 1,
    };

    const inserted = await insertOrderLedgerWithSchemaFallback(supabase, row, generateOrderUid);
    const { data: order, error } = inserted;
    if (error) return NextResponse.json({ error: String((error as { message?: string }).message ?? error) }, { status: 500 });

    // Insert order items
    if (order && order.id) {
      const itemsToInsert = orderItemsForInsert.map((item) => ({
        order_id: order.id,
        ...item,
      }));

      const { error: itemsError } = await supabase.from("order_ledger_items").insert(itemsToInsert);
      if (itemsError) {
        // Rollback order if items fail
        await supabase.from("order_ledger").delete().eq("id", order.id);
        return NextResponse.json({ error: `Failed to save order items: ${itemsError.message}` }, { status: 500 });
      }
    }

    const exclude_shipping_from_cost_eff = Boolean(body.exclude_shipping_from_cost);
    const orderOut = order
      ? {
          ...order,
          exclude_shipping_from_cost:
            typeof order.exclude_shipping_from_cost === "boolean"
              ? order.exclude_shipping_from_cost
              : exclude_shipping_from_cost_eff,
          approval_status: (order as { approval_status?: string }).approval_status ?? "pending",
          items: orderItemsForInsert,
        }
      : order;

    const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
    const itemsDesc = items.map((i) => {
      const d = designMap.get(i.cost_design_id);
      return `${d?.keychain_design || "?"} ×${i.quantity}`;
    }).join(", ");
    const shipNote = exclude_shipping_from_cost ? " — shipping fees excluded from cost" : "";
    await insertAuditLog(
      user.username,
      "SUBMIT_ORDER_LEDGER",
      `Order ${(orderOut as { order_uid?: string })?.order_uid ?? ""} — ${customer_name} — items: ${itemsDesc} — sell ${money(grandTotalSelling)} — cost ${money(grandTotalCost)} — net ${money(net_profit)} — payment ${row.payment_method} (${row.payment_status}) — delivery ${row.delivery_status}${shipNote} — pending admin approval`,
    );

    if (user.role !== "admin") {
      const uid = String((orderOut as { order_uid?: string })?.order_uid ?? "");
      const open = `${appBaseUrl()}/?nav=orderApprovals`;
      void notifyAdminsPendingApproval({
        subject: `New order pending approval: ${uid}`,
        htmlBody: `<p><strong>${user.username}</strong> submitted a new order <strong>${uid}</strong> (${customer_name}).</p><p><a href="${open}">Open Order approvals</a></p>`,
        kind: "order_new",
        nav: "orderApprovals",
      }).catch(() => {});
    }

    return NextResponse.json({ order: orderOut });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}