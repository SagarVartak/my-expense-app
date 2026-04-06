"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import EditOrderModal from "@/components/EditOrderModal";
import { fmtOrderDate, fmtOrderMoney } from "@/lib/orderLedgerDisplay";
import type { OrderLedgerEntry, SessionUser } from "@/lib/types";

type Props = {
  currencySymbol: string;
  currentUser: SessionUser;
  refreshSignal: number;
  onOrderMutated?: () => void;
  emptyHint?: string;
};

export default function OrdersTable({
  currencySymbol,
  currentUser,
  refreshSignal,
  onOrderMutated,
  emptyHint = 'No orders yet. Open Order Ledger and click "Add order".',
}: Props) {
  const [orders, setOrders] = useState<OrderLedgerEntry[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const hasOrdersLoaded = useRef(false);
  const [editing, setEditing] = useState<OrderLedgerEntry | null>(null);

  const loadOrders = useCallback(async (soft: boolean) => {
    if (!soft || !hasOrdersLoaded.current) setLoadingOrders(true);
    try {
      const res = await fetch("/api/order-ledger", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not load orders.");
        return;
      }
      setOrders((data.orders || []) as OrderLedgerEntry[]);
      hasOrdersLoaded.current = true;
    } catch {
      toast.error("Could not load orders.");
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders(hasOrdersLoaded.current);
  }, [refreshSignal, loadOrders]);

  const approvalLabel = (o: OrderLedgerEntry) => {
    const st = o.approval_status ?? "approved";
    if (st === "approved") return "Approved";
    if (st === "pending") return "Pending";
    return "Rejected";
  };

  const canEditOrder = (o: OrderLedgerEntry) => {
    const st = o.approval_status ?? "approved";
    return st === "approved";
  };

  const canDeleteOrder = (o: OrderLedgerEntry) => {
    const st = o.approval_status ?? "approved";
    if (currentUser.role === "admin") return true;
    if (o.created_by !== currentUser.username) return false;
    return st === "pending" || st === "rejected";
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this order?")) return;
    try {
      const res = await fetch(`/api/order-ledger/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not delete.");
        return;
      }
      toast.success("Order removed.");
      setOrders((prev) => prev.filter((o) => o.id !== id));
      onOrderMutated?.();
    } catch {
      toast.error("Could not delete.");
    }
  };

  const colSpan = 18;

  return (
    <section className="card">
      <EditOrderModal
        open={editing !== null}
        order={editing}
        currencySymbol={currencySymbol}
        onClose={() => setEditing(null)}
        onRequestSubmitted={() => {
          onOrderMutated?.();
        }}
      />
      <h2>Orders</h2>
      <p className="calc-lead muted" style={{ marginBottom: 12 }}>
        {loadingOrders && !hasOrdersLoaded.current ? "Loading…" : `${orders.length} orders.`}{" "}
        <span className="muted" style={{ fontSize: 13 }}>
          New orders and edits appear for everyone only after an admin approves them under Approvals.
        </span>
      </p>
      <div className="order-table-wrap">
        <table className="order-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Approval</th>
              <th>Date</th>
              <th>Design</th>
              <th>Customer name</th>
              <th>Shipping address</th>
              <th className="amt">Actual weight (g)</th>
              <th className="amt">Total cost price</th>
              <th>Ship in cost</th>
              <th className="amt">Selling price</th>
              <th className="amt">Net profit</th>
              <th>Payment method</th>
              <th>Payment status</th>
              <th>Delivery status</th>
              <th>Source</th>
              <th>Feedback</th>
              <th>Customer behaviour</th>
              <th className="design-th-action">Action</th>
            </tr>
          </thead>
          <tbody>
            {loadingOrders && !hasOrdersLoaded.current ? (
              <tr>
                <td colSpan={colSpan} className="muted">
                  Loading orders…
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="muted">
                  {emptyHint}
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const st = o.approval_status ?? "approved";
                return (
                  <tr key={o.id}>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                      {o.order_uid}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      <span
                        className="pill"
                        style={
                          st === "pending"
                            ? { borderColor: "rgba(240, 180, 41, 0.45)", color: "#f0d090" }
                            : st === "rejected"
                              ? { borderColor: "rgba(255, 120, 140, 0.4)", color: "#ffb0c0" }
                              : undefined
                        }
                        title={approvalLabel(o)}
                      >
                        {approvalLabel(o)}
                      </span>
                    </td>
                    <td>{fmtOrderDate(o.order_date)}</td>
                    <td style={{ maxWidth: 140 }} title={o.design_name}>
                      <span className="design-name-cell">{o.design_name || "—"}</span>
                    </td>
                    <td>{o.customer_name}</td>
                    <td className="order-td-wrap" style={{ maxWidth: 180, fontSize: 12 }}>
                      {o.shipping_address || "—"}
                    </td>
                    <td className="amt">{Number(o.actual_weight_g).toFixed(2)}</td>
                    <td className="amt">{fmtOrderMoney(currencySymbol, Number(o.total_cost_price))}</td>
                    <td style={{ fontSize: 12 }} title="Whether the saved design’s shipping line was included in cost">
                      {o.exclude_shipping_from_cost === true ? (
                        <span className="muted">Waived</span>
                      ) : (
                        <span>Yes</span>
                      )}
                    </td>
                    <td className="amt">{fmtOrderMoney(currencySymbol, Number(o.selling_price))}</td>
                    <td className={`amt${Number(o.net_profit) >= 0 ? " design-net-pos" : " design-net-neg"}`}>
                      {fmtOrderMoney(currencySymbol, Number(o.net_profit))}
                    </td>
                    <td>{o.payment_method}</td>
                    <td>{o.payment_status}</td>
                    <td>{o.delivery_status}</td>
                    <td className="order-td-wrap" style={{ maxWidth: 100, fontSize: 12 }}>
                      {o.source || "—"}
                    </td>
                    <td className="order-td-wrap" style={{ maxWidth: 160, fontSize: 12 }}>
                      {o.feedback || "—"}
                    </td>
                    <td className="order-td-wrap" style={{ maxWidth: 160, fontSize: 12 }}>
                      {o.customer_behaviour || "—"}
                    </td>
                    <td>
                      <div className="design-table-actions">
                        {canEditOrder(o) ? (
                          <button type="button" onClick={() => setEditing(o)}>
                            Edit
                          </button>
                        ) : null}
                        {canDeleteOrder(o) ? (
                          <button className="delete" type="button" onClick={() => void handleDelete(o.id)}>
                            Delete
                          </button>
                        ) : null}
                        {!canEditOrder(o) && !canDeleteOrder(o) ? <span className="muted">—</span> : null}
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
