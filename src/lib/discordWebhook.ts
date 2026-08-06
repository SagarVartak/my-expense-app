/**
 * Optional Discord notifications when DISCORD_WEBHOOK_URL is set (server-only).
 * @see https://discord.com/developers/docs/resources/webhook#execute-webhook
 */

import { APP_NAME } from "@/lib/appMeta";

type ExpenseRow = {
  id: string;
  entry_uid?: string | null;
  expense_date: string;
  category: string;
  amount: number;
  paid_by: string;
  payment_method: string;
  description?: string | null;
  created_at?: string | null;
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * Fire-and-forget: does not block the API response; logs errors to the server console.
 */
export function notifyDiscordExpenseAdded(expense: ExpenseRow, addedBy: string): void {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!url) return;

  const currency = process.env.DISCORD_CURRENCY_SYMBOL?.trim() || "₹";
  const amountStr = `${currency}${Number(expense.amount).toFixed(2)}`;
  const description = (expense.description ?? "").trim() || "—";
  const entryLabel = expense.entry_uid?.trim() || expense.id;

  const embed: Record<string, unknown> = {
    title: "New expense",
    color: 0x60adff,
    fields: [
      { name: "Entry ID", value: truncate(entryLabel, 1024), inline: true },
      { name: "Date", value: truncate(expense.expense_date, 1024), inline: true },
      { name: "Category", value: truncate(expense.category, 1024), inline: true },
      { name: "Amount", value: truncate(amountStr, 1024), inline: true },
      { name: "Paid by", value: truncate(expense.paid_by, 1024), inline: true },
      { name: "Payment method", value: truncate(expense.payment_method, 1024), inline: true },
      { name: "Added by", value: truncate(addedBy, 1024), inline: true },
      { name: "Description", value: truncate(description, 1024), inline: false },
    ],
    footer: { text: APP_NAME },
  };
  if (expense.created_at) {
    const d = new Date(expense.created_at);
    if (!Number.isNaN(d.getTime())) embed.timestamp = d.toISOString();
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  }).catch((err: unknown) => {
    console.error("[discord webhook] notify failed:", err);
  });
}

type CostDesignRow = {
  keychain_design: string;
  print_weight_g: number;
  filament_cost_per_g: number;
  electricity_fee: number;
  chain_cost: number;
  pouch_cost: number;
  card_cost: number;
  primer_cost: number;
  clearcoat_cost: number;
  key_caps_cost: number;
  colour_cost: number;
  shipping: number;
  total_cost_price: number;
  created_at?: string | null;
};

/**
 * Optional Discord when DISCORD_WEBHOOK_COST_CALCULATION_URL is set (server-only).
 * @see https://discord.com/developers/docs/resources/webhook#execute-webhook
 */
export function notifyDiscordCostDesignSaved(
  design: CostDesignRow,
  savedBy: string,
  options?: { variant?: "create" | "update" },
): void {
  const url = process.env.DISCORD_WEBHOOK_COST_CALCULATION_URL?.trim();
  if (!url) return;

  const variant = options?.variant ?? "create";
  const title = variant === "update" ? "Cost design updated" : "Cost design saved";
  const actorLabel = variant === "update" ? "Updated by" : "Saved by";

  const currency = process.env.DISCORD_CURRENCY_SYMBOL?.trim() || "₹";
  const fmt = (n: number) => `${currency}${Number(n).toFixed(2)}`;
  const pw = Number(design.print_weight_g);
  const fpg = Number(design.filament_cost_per_g);
  const filamentLine = pw * fpg;

  const embed: Record<string, unknown> = {
    title,
    color: variant === "update" ? 0xf0b429 : 0x60adff,
    fields: [
      { name: "Design", value: truncate(design.keychain_design, 1024), inline: false },
      { name: "Print weight (g)", value: truncate(String(pw), 1024), inline: true },
      { name: "Filament cost per (g)", value: truncate(fmt(fpg), 1024), inline: true },
      { name: "Filament line", value: truncate(fmt(filamentLine), 1024), inline: true },
      { name: "Electricity fee", value: truncate(fmt(Number(design.electricity_fee)), 1024), inline: true },
      { name: "Chain cost", value: truncate(fmt(Number(design.chain_cost)), 1024), inline: true },
      { name: "Pouch cost", value: truncate(fmt(Number(design.pouch_cost)), 1024), inline: true },
      { name: "Card cost", value: truncate(fmt(Number(design.card_cost)), 1024), inline: true },
      { name: "Primer cost", value: truncate(fmt(Number(design.primer_cost)), 1024), inline: true },
      { name: "Clearcoat cost", value: truncate(fmt(Number(design.clearcoat_cost)), 1024), inline: true },
      { name: "Key caps", value: truncate(fmt(Number(design.key_caps_cost)), 1024), inline: true },
      { name: "Shipping", value: truncate(fmt(Number(design.shipping)), 1024), inline: true },
      { name: "Total cost price", value: truncate(fmt(Number(design.total_cost_price)), 1024), inline: false },
      { name: actorLabel, value: truncate(savedBy, 1024), inline: true },
    ],
    footer: { text: `${APP_NAME} · Cost calculator` },
  };
  if (design.created_at) {
    const d = new Date(design.created_at);
    if (!Number.isNaN(d.getTime())) embed.timestamp = d.toISOString();
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  }).catch((err: unknown) => {
    console.error("[discord webhook] cost design notify failed:", err);
  });
}

type OrderLedgerRow = {
  order_uid: string;
  order_date: string;
  design_name: string;
  customer_name: string;
  customer_phone?: string | null;
  shipment_tracking?: string | null;
  shipping_address?: string | null;
  actual_weight_g?: number | null;
  total_cost_price: number;
  selling_price: number;
  net_profit: number;
  payment_method: string;
  payment_status: string;
  delivery_status: string;
  source?: string | null;
  created_at?: string | null;
  exclude_shipping_from_cost?: boolean | null;
};

function orderLedgerWebhookUrl(): string | undefined {
  return (
    process.env.DISCORD_Webhook_Order_ledger_url?.trim() ||
    process.env.DISCORD_WEBHOOK_ORDER_LEDGER_URL?.trim()
  );
}

/**
 * Optional Discord when DISCORD_Webhook_Order_ledger_url (or DISCORD_WEBHOOK_ORDER_LEDGER_URL) is set (server-only).
 */
export function notifyDiscordOrderLedgerAdded(order: OrderLedgerRow, addedBy: string): void {
  const url = orderLedgerWebhookUrl();
  if (!url) return;

  const currency = process.env.DISCORD_CURRENCY_SYMBOL?.trim() || "₹";
  const fmt = (n: number) => `${currency}${Number(n).toFixed(2)}`;
  const ship = (order.shipping_address ?? "").trim() || "—";
  const phone = (order.customer_phone ?? "").trim() || "—";
  const tracking = (order.shipment_tracking ?? "").trim() || "—";
  const src = (order.source ?? "").trim() || "—";

  const w = order.actual_weight_g;
  const weightLine =
    w != null && Number.isFinite(Number(w)) ? truncate(String(Number(w)), 1024) : "—";

  const embed: Record<string, unknown> = {
    title: "New order (ledger)",
    color: 0x43b581,
    fields: [
      { name: "Order ID", value: truncate(order.order_uid, 1024), inline: true },
      { name: "Date", value: truncate(order.order_date, 1024), inline: true },
      { name: "Design", value: truncate(order.design_name || "—", 1024), inline: false },
      { name: "Customer", value: truncate(order.customer_name, 1024), inline: true },
      { name: "Phone", value: truncate(phone, 1024), inline: true },
      { name: "Tracking #", value: truncate(tracking, 1024), inline: true },
      { name: "Actual weight (g)", value: weightLine, inline: true },
      { name: "Selling price", value: truncate(fmt(Number(order.selling_price)), 1024), inline: true },
      {
        name: "Total cost",
        value: truncate(
          order.exclude_shipping_from_cost
            ? `${fmt(Number(order.total_cost_price))} (design shipping excluded)`
            : fmt(Number(order.total_cost_price)),
          1024,
        ),
        inline: true,
      },
      { name: "Net profit", value: truncate(fmt(Number(order.net_profit)), 1024), inline: true },
      { name: "Payment", value: truncate(`${order.payment_method} · ${order.payment_status}`, 1024), inline: true },
      { name: "Delivery", value: truncate(order.delivery_status, 1024), inline: true },
      { name: "Source", value: truncate(src, 1024), inline: true },
      { name: "Shipping address", value: truncate(ship, 1024), inline: false },
      { name: "Added by", value: truncate(addedBy, 1024), inline: true },
    ],
    footer: { text: `${APP_NAME} · Order ledger` },
  };
  if (order.created_at) {
    const d = new Date(order.created_at);
    if (!Number.isNaN(d.getTime())) embed.timestamp = d.toISOString();
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  }).catch((err: unknown) => {
    console.error("[discord webhook] order ledger notify failed:", err);
  });
}
