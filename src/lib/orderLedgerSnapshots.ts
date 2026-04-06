import type { OrderLedgerSnapshotJson } from "@/lib/types";

export function orderSnapshotFromRow(r: Record<string, unknown>): OrderLedgerSnapshotJson {
  return {
    order_uid: String(r.order_uid ?? ""),
    order_date: String(r.order_date ?? "").slice(0, 10),
    cost_design_id: r.cost_design_id != null ? String(r.cost_design_id) : null,
    design_name: String(r.design_name ?? ""),
    customer_name: String(r.customer_name ?? ""),
    shipping_address: String(r.shipping_address ?? ""),
    actual_weight_g: Number(r.actual_weight_g ?? 0),
    total_cost_price: Number(r.total_cost_price ?? 0),
    selling_price: Number(r.selling_price ?? 0),
    net_profit: Number(r.net_profit ?? 0),
    payment_method: String(r.payment_method ?? ""),
    payment_status: String(r.payment_status ?? ""),
    delivery_status: String(r.delivery_status ?? ""),
    source: String(r.source ?? ""),
    feedback: String(r.feedback ?? ""),
    customer_behaviour: String(r.customer_behaviour ?? ""),
    exclude_shipping_from_cost: Boolean(r.exclude_shipping_from_cost),
    units: Math.max(1, Math.floor(Number(r.units ?? 1))),
  };
}

/** DB update payload from approved edit snapshot (immutable fields excluded). */
export function orderSnapshotToUpdateRow(s: OrderLedgerSnapshotJson) {
  return {
    order_date: s.order_date,
    cost_design_id: s.cost_design_id,
    design_name: s.design_name,
    customer_name: s.customer_name,
    shipping_address: s.shipping_address,
    actual_weight_g: s.actual_weight_g,
    total_cost_price: s.total_cost_price,
    selling_price: s.selling_price,
    net_profit: s.net_profit,
    payment_method: s.payment_method,
    payment_status: s.payment_status,
    delivery_status: s.delivery_status,
    source: s.source,
    feedback: s.feedback,
    customer_behaviour: s.customer_behaviour,
    exclude_shipping_from_cost: s.exclude_shipping_from_cost,
    units: s.units,
  };
}
