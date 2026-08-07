"use client";

import { useMemo } from "react";
import { fmtOrderDate } from "@/lib/orderLedgerDisplay";
import type { OrderLedgerEntry, DeadlineStatus } from "@/lib/types";

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

const DAYS_THRESHOLD = 7;

function getDaysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const deadline = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const diff = deadline.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

type Props = {
  orders: OrderLedgerEntry[];
  _refreshSignal?: number;
};

export default function DeadlineSidebar({ orders, _refreshSignal = 0 }: Props) {
  const nearDeadlines = useMemo(() => {
    return orders
      .filter((o) => {
        const days = getDaysUntil(o.deadline_date);
        return days !== null && days <= DAYS_THRESHOLD && days >= 0 && o.deadline_status !== "delivered" && o.deadline_status !== "cancelled";
      })
      .sort((a, b) => {
        const daysA = getDaysUntil(a.deadline_date) ?? 999;
        const daysB = getDaysUntil(b.deadline_date) ?? 999;
        return daysA - daysB;
      });
  }, [orders]);

  if (nearDeadlines.length === 0) return null;

  return (
    <aside className="deadline-sidebar" aria-label="Upcoming deadlines">
      <div className="deadline-sidebar-header">
        <h3>⚠ Upcoming Deadlines</h3>
        <span className="deadline-count">{nearDeadlines.length}</span>
      </div>
      <ul className="deadline-list">
        {nearDeadlines.map((order) => {
          const days = getDaysUntil(order.deadline_date);
          const status = order.deadline_status ?? "not_started";
          const colors = DEADLINE_COLORS[status];
          const isOverdue = days !== null && days < 0;
          const isToday = days === 0;
          const isTomorrow = days === 1;

          return (
            <li key={order.id} className="deadline-item" style={{ borderLeftColor: colors.border }}>
              <div className="deadline-main">
                <div className="deadline-order-info">
                  <span className="deadline-order-id">{order.order_uid}</span>
                  <span className="deadline-customer">{order.customer_name}</span>
                </div>
                <div className="deadline-date-status">
                  <span className="deadline-date" style={{ color: isOverdue ? "#f87171" : isToday ? "#fbbf24" : "var(--text)" }}>
                    {order.deadline_date ? fmtOrderDate(order.deadline_date) : "—"}
                    {days !== null && (
                      <span className="deadline-days" style={{ color: isOverdue ? "#f87171" : isToday ? "#fbbf24" : "var(--muted)" }}>
                        {isOverdue ? `${Math.abs(days)} days overdue` : isToday ? "Today" : isTomorrow ? "Tomorrow" : `in ${days} days`}
                      </span>
                    )}
                  </span>
                  <select
                    className="deadline-status-select"
                    value={status}
                    onChange={(e) => {
                      const newStatus = e.target.value as DeadlineStatus;
                      fetch(`/api/order-ledger/${order.id}/deadline-status`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ deadline_status: newStatus }),
                      }).then(() => window.location.reload());
                    }}
                    style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
                  >
                    {DEADLINE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {DEADLINE_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}