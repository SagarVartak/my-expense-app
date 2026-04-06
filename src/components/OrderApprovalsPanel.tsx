"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { fmtCurrency } from "@/lib/currencyFormat";
import type { OrderLedgerChangeRequest, OrderLedgerEntry } from "@/lib/types";

type Props = {
  currencySymbol: string;
  refreshSignal: number;
  onMutated?: () => void;
  onOrderApplied?: () => void;
};

export default function OrderApprovalsPanel({ currencySymbol, refreshSignal, onMutated, onOrderApplied }: Props) {
  const [newOrders, setNewOrders] = useState<OrderLedgerEntry[]>([]);
  const [editReqs, setEditReqs] = useState<OrderLedgerChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (soft: boolean) => {
    if (!soft || !loaded.current) setLoading(true);
    try {
      const [or, er] = await Promise.all([
        fetch("/api/order-ledger", { cache: "no-store" }),
        fetch("/api/order-ledger-change-requests", { cache: "no-store" }),
      ]);
      const od = await or.json();
      const ed = await er.json();
      if (!or.ok) {
        toast.error(od.error || "Could not load orders.");
        return;
      }
      if (!er.ok && ed.error) {
        toast.error(ed.error);
        return;
      }
      const orders = (od.orders || []) as OrderLedgerEntry[];
      setNewOrders(orders.filter((o) => (o.approval_status ?? "approved") === "pending"));
      setEditReqs(((ed.requests || []) as OrderLedgerChangeRequest[]).filter((r) => r.status === "pending"));
      loaded.current = true;
    } catch {
      toast.error("Could not load approvals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(loaded.current);
  }, [refreshSignal, load]);

  const approveNew = async (o: OrderLedgerEntry) => {
    if (!window.confirm(`Approve new order ${o.order_uid}?`)) return;
    setBusy(o.id);
    try {
      const res = await fetch(`/api/order-ledger/${o.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not approve.");
        return;
      }
      toast.success("Order approved.");
      onOrderApplied?.();
      onMutated?.();
      void load(true);
    } catch {
      toast.error("Could not approve.");
    } finally {
      setBusy(null);
    }
  };

  const rejectNew = async (o: OrderLedgerEntry) => {
    const reason = window.prompt("Reject reason (optional):") ?? "";
    setBusy(o.id);
    try {
      const res = await fetch(`/api/order-ledger/${o.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reject_reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not reject.");
        return;
      }
      toast.info("Order rejected.");
      onMutated?.();
      void load(true);
    } catch {
      toast.error("Could not reject.");
    } finally {
      setBusy(null);
    }
  };

  const approveEdit = async (r: OrderLedgerChangeRequest) => {
    if (!window.confirm("Apply this order edit?")) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/order-ledger-change-requests/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not approve.");
        return;
      }
      toast.success("Order edit applied.");
      onOrderApplied?.();
      onMutated?.();
      void load(true);
    } catch {
      toast.error("Could not approve.");
    } finally {
      setBusy(null);
    }
  };

  const rejectEdit = async (r: OrderLedgerChangeRequest) => {
    const reason = window.prompt("Reject reason (optional):") ?? "";
    setBusy(r.id);
    try {
      const res = await fetch(`/api/order-ledger-change-requests/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reject_reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not reject.");
        return;
      }
      toast.info("Edit rejected.");
      onMutated?.();
      void load(true);
    } catch {
      toast.error("Could not reject.");
    } finally {
      setBusy(null);
    }
  };

  const pendingCount = newOrders.length + editReqs.length;

  return (
    <section className="card" style={{ marginTop: 20 }}>
      <h2>Order approvals</h2>
      <p className="calc-lead muted" style={{ marginBottom: 12 }}>
        {loading && !loaded.current ? "Loading…" : `${pendingCount} pending (new orders + edits).`}
      </p>

      <h3 style={{ fontSize: 15, marginBottom: 8 }}>New orders</h3>
      <div className="design-table-wrap">
        <table className="design-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th className="amt">Net</th>
              <th>By</th>
              <th className="design-th-action">Actions</th>
            </tr>
          </thead>
          <tbody>
            {newOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No pending new orders.
                </td>
              </tr>
            ) : (
              newOrders.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontSize: 12 }}>{o.order_uid}</td>
                  <td>{o.customer_name}</td>
                  <td className="amt">{fmtCurrency(currencySymbol, Number(o.net_profit))}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {o.created_by}
                  </td>
                  <td>
                    <div className="design-table-actions">
                      <button type="button" disabled={busy === o.id} onClick={() => void approveNew(o)}>
                        {busy === o.id ? "…" : "Approve"}
                      </button>
                      <button className="delete" type="button" disabled={busy === o.id} onClick={() => void rejectNew(o)}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 15, margin: "20px 0 8px" }}>Order edit requests</h3>
      <div className="design-table-wrap">
        <table className="design-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th className="amt">Total before → after</th>
              <th>By</th>
              <th className="design-th-action">Actions</th>
            </tr>
          </thead>
          <tbody>
            {editReqs.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No pending order edits.
                </td>
              </tr>
            ) : (
              editReqs.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontSize: 12 }}>{r.proposed_snapshot.order_uid}</td>
                  <td className="amt" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {fmtCurrency(currencySymbol, r.previous_snapshot.total_cost_price)} →{" "}
                    {fmtCurrency(currencySymbol, r.proposed_snapshot.total_cost_price)}
                  </td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {r.requested_by}
                  </td>
                  <td>
                    <div className="design-table-actions">
                      <button type="button" disabled={busy === r.id} onClick={() => void approveEdit(r)}>
                        {busy === r.id ? "…" : "Approve"}
                      </button>
                      <button className="delete" type="button" disabled={busy === r.id} onClick={() => void rejectEdit(r)}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
