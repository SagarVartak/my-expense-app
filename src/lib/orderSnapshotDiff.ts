import type { OrderLedgerSnapshotJson } from "@/lib/types";

export type OrderSnapshotFieldKind = "money" | "text" | "number" | "bool" | "date";

/** All user-visible order snapshot fields for diff display (same order as form importance). */
export const ORDER_SNAPSHOT_DIFF_FIELDS: {
  key: keyof OrderLedgerSnapshotJson;
  label: string;
  kind: OrderSnapshotFieldKind;
}[] = [
  { key: "order_uid", label: "Order ID", kind: "text" },
  { key: "order_date", label: "Order date", kind: "date" },
  { key: "cost_design_id", label: "Saved design ID", kind: "text" },
  { key: "design_name", label: "Design", kind: "text" },
  { key: "customer_name", label: "Customer", kind: "text" },
  { key: "customer_phone", label: "Customer phone", kind: "text" },
  { key: "shipment_tracking", label: "Shipment tracking", kind: "text" },
  { key: "shipping_address", label: "Shipping address", kind: "text" },
  { key: "actual_weight_g", label: "Weight (g)", kind: "number" },
  { key: "units", label: "Units", kind: "number" },
  { key: "total_cost_price", label: "Total cost", kind: "money" },
  { key: "selling_price", label: "Selling price", kind: "money" },
  { key: "net_profit", label: "Net profit", kind: "money" },
  { key: "payment_method", label: "Payment method", kind: "text" },
  { key: "payment_status", label: "Payment status", kind: "text" },
  { key: "delivery_status", label: "Delivery status", kind: "text" },
  { key: "source", label: "Source", kind: "text" },
  { key: "feedback", label: "Feedback", kind: "text" },
  { key: "customer_behaviour", label: "Customer behaviour", kind: "text" },
  { key: "exclude_shipping_from_cost", label: "Exclude shipping from cost", kind: "bool" },
];

function numClose(a: number, b: number, eps: number) {
  return Math.abs(a - b) < eps;
}

export function orderSnapshotFieldChanged(
  key: keyof OrderLedgerSnapshotJson,
  prev: OrderLedgerSnapshotJson,
  next: OrderLedgerSnapshotJson,
): boolean {
  const a = prev[key];
  const b = next[key];
  if (key === "cost_design_id") return String(a ?? "") !== String(b ?? "");
  if (key === "exclude_shipping_from_cost") return Boolean(a) !== Boolean(b);
  if (typeof a === "number" && typeof b === "number") {
    if (key === "actual_weight_g") return !numClose(a, b, 1e-6);
    if (key === "units") return Math.round(a) !== Math.round(b);
    return !numClose(a, b, 0.005);
  }
  return String(a ?? "") !== String(b ?? "");
}

export function getChangedOrderSnapshotFields(prev: OrderLedgerSnapshotJson, next: OrderLedgerSnapshotJson) {
  return ORDER_SNAPSHOT_DIFF_FIELDS.filter(({ key }) => orderSnapshotFieldChanged(key, prev, next));
}
