"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { fmtOrderDate, fmtOrderMoney } from "@/lib/orderLedgerDisplay";
import type { OrderLedgerEntry, DeadlineStatus, SessionUser } from "@/lib/types";

const DEADLINE_STATUSES: DeadlineStatus[] = [
  "not_started",
  "print_started",
  "print_done",
  "in_transit",
  "delivered",
  "cancelled",
];

const DEADLINE_LABELS: Record<DeadlineStatus, string> = {
  not_started: "Not Started",
  print_started: "Print Started",
  print_done: "Print Done",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const DEADLINE_COLORS: Record<DeadlineStatus, { bg: string; text: string; border: string }> = {
  not_started: { bg: "rgba(240, 180, 41, 0.15)", text: "#f0d090", border: "rgba(240, 180, 41, 0.4)" },
  print_started: { bg: "rgba(59, 130, 246, 0.15)", text: "#93c5fd", border: "rgba(59, 130, 246, 0.4)" },
  print_done: { bg: "rgba(34, 197, 94, 0.15)", text: "#86efac", border: "rgba(34, 197, 94, 0.4)" },
  in_transit: { bg: "rgba(168, 85, 247, 0.15)", text: "#d8b4fe", border: "rgba(168, 85, 247, 0.4)" },
  delivered: { bg: "rgba(34, 197, 94, 0.1)", text: "#86efac", border: "rgba(34, 197, 94, 0.3)" },
  cancelled: { bg: "rgba(239, 68, 68, 0.1)", text: "#fca5a5", border: "rgba(239, 68, 68, 0.3)" },
};

type FilterStatus = "all" | "upcoming" | "overdue" | "completed" | DeadlineStatus;

export default function DeadlinesPage({ currencySymbol, currentUser, refreshSignal = 0 }: { currencySymbol: string; currentUser: SessionUser; refreshSignal?: number }) {
  const [orders, setOrders] = useState<OrderLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/order-ledger", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not load orders.");
        return;
      }
      setOrders((data.orders || []) as OrderLedgerEntry[]);
    } catch {
      toast.error("Could not load orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [refreshSignal]);

  const filteredOrders = orders.filter((o) => {
    if (search) {
      const term = search.toLowerCase();
      if (
        !o.order_uid.toLowerCase().includes(term) &&
        !o.customer_name.toLowerCase().includes(term) &&
        !o.customer_phone?.toLowerCase().includes(term)
      ) return false;
    }

    const status = o.deadline_status ?? "not_started";
    const daysUntil = o.deadline_date ? Math.ceil((new Date(o.deadline_date).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24)) : null;

    switch (filter) {
      case "upcoming":
        return daysUntil !== null && daysUntil >= 0 && daysUntil <= 7 && status !== "delivered" && status !== "cancelled";
      case "overdue":
        return daysUntil !== null && daysUntil < 0 && status !== "delivered" && status !== "cancelled";
      case "completed":
        return status === "delivered" || status === "cancelled";
      case "all":
      default:
        if (DEADLINE_STATUSES.includes(filter as DeadlineStatus)) {
          return status === filter;
        }
        return true;
    }
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const dateA = a.deadline_date ? new Date(a.deadline_date).getTime() : Infinity;
    const dateB = b.deadline_date ? new Date(b.deadline_date).getTime() : Infinity;
    return dateA - dateB;
  });

  const getDaysUntil = (dateStr: string | null | undefined): number | null => {
    if (!dateStr) return null;
    const deadline = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);
    const diff = deadline.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const handleStatusChange = async (orderId: string, newStatus: DeadlineStatus) => {
    try {
      const res = await fetch(`/api/order-ledger/${orderId}/deadline-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadline_status: newStatus }),
      });
      if (!res.ok) {
        toast.error("Failed to update status");
        return;
      }
      toast.success(`Status updated to ${DEADLINE_LABELS[newStatus]}`);
      loadOrders();
    } catch {
      toast.error("Could not update status");
    }
  };

  return (
    <section className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <h2>Order Deadlines</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            type="search"
            placeholder="Search order ID, customer, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220, minWidth: 180 }}
          />
          <select value={filter} onChange={(e) => setFilter(e.target.value as FilterStatus)} style={{ minWidth: 160 }}>
            <option value="all">All</option>
            <option value="upcoming">Upcoming (7 days)</option>
            <option value="overdue">Overdue</option>
            <option value="completed">Completed</option>
            {DEADLINE_STATUSES.map((s) => (
              <option key={s} value={s}>{DEADLINE_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="table-scroll-wrap">
        <table className="design-table">
          <thead>
            <tr>
              <th className="design-th-design">Order ID</th>
              <th>Date</th>
              <th>Deadline</th>
              <th>Days Left</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Items</th>
              <th className="amt">Total Qty</th>
              <th className="amt">Total Cost</th>
              <th className="amt">Total Selling</th>
              <th className="amt">Net Profit</th>
              <th>Payment</th>
              <th>Delivery</th>
              <th className="design-th-action">Deadline Status</th>
              <th className="design-th-action">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={15} className="muted" style={{ textAlign: "center", padding: 32 }}>
                  Loading…
                </td>
              </tr>
            ) : sortedOrders.length === 0 ? (
              <tr>
                <td colSpan={15} className="muted" style={{ textAlign: "center", padding: 32 }}>
                  No orders match the current filter.
                </td>
              </tr>
            ) : (
              sortedOrders.map((o) => {
                const status = o.deadline_status ?? "not_started";
                const colors = DEADLINE_COLORS[status];
                const days = getDaysUntil(o.deadline_date);
                const isOverdue = days !== null && days < 0;
                const isToday = days === 0;
                const items = o.items ?? [];
                const totalQty = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
                const itemsDisplay = items.length > 0
                  ? items.map((item) => (
                      <div key={item.id} style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
                        <span>{item.keychain_design || "—"}</span>
                        <span className="muted">×{item.quantity}</span>
                      </div>
                    ))
                  : o.design_name
                    ? <span className="design-name-cell" title={o.design_name}>{o.design_name}</span>
                    : <span className="muted">—</span>;

                return (
                <tr key={o.id}>
                  <td className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{o.order_uid}</td>
                  <td>{fmtOrderDate(o.order_date)}</td>
                  <td style={{ fontWeight: 500, color: isOverdue ? "#f87171" : isToday ? "#fbbf24" : "var(--text)" }}>
                    {o.deadline_date ? fmtOrderDate(o.deadline_date) : <span className="muted">—</span>}
                  </td>
                  <td style={{ fontWeight: 500, color: isOverdue ? "#f87171" : isToday ? "#fbbf24" : days !== null && days <= 3 ? "#fbbf24" : "var(--text)" }}>
                    {days !== null
                      ? isOverdue
                        ? <span style={{ color: "#f87171" }}>{Math.abs(days)} days overdue</span>
                        : isToday
                        ? "Today"
                        : days === 1
                        ? "Tomorrow"
                        : `in ${days} days`
                      : <span className="muted">—</span>}
                  </td>
                  <td>{o.customer_name}</td>
                  <td className="order-td-wrap" style={{ maxWidth: 120, fontSize: 12 }}>{o.customer_phone?.trim() || "—"}</td>
                  <td style={{ maxWidth: 200 }}>{itemsDisplay}</td>
                  <td className="amt" style={{ fontSize: 12 }}>{totalQty}</td>
                  <td className="amt">{fmtOrderMoney(currencySymbol, Number(o.total_cost_price))}</td>
                  <td className="amt">{fmtOrderMoney(currencySymbol, Number(o.selling_price))}</td>
                  <td className={`amt${Number(o.net_profit) >= 0 ? " design-net-pos" : " design-net-neg"}`}>
                    {fmtOrderMoney(currencySymbol, Number(o.net_profit))}
                  </td>
                  <td>{o.payment_method}</td>
                  <td>{o.delivery_status}</td>
                  <td className="design-th-action">
                    <select
                      value={status}
                      onChange={(e) => handleStatusChange(o.id, e.target.value as DeadlineStatus)}
                      style={{
                        background: colors.bg,
                        color: colors.text,
                        borderColor: colors.border,
                        padding: "6px 10px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 500,
                        minWidth: 140,
                      }}
                    >
                      {DEADLINE_STATUSES.map((s) => (
                        <option key={s} value={s}>{DEADLINE_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="design-th-action">
                    <div className="design-table-actions">
                      <button type="button" onClick={() => handleStatusChange(o.id, "print_started")} title="Mark Print Started">🖨</button>
                      <button type="button" onClick={() => handleStatusChange(o.id, "print_done")} title="Mark Print Done">✓</button>
                      <button type="button" onClick={() => handleStatusChange(o.id, "in_transit")} title="Mark In Transit">🚚</button>
                      <button type="button" onClick={() => handleStatusChange(o.id, "delivered")} title="Mark Delivered">📦</button>
                    </div>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}