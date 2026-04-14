"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import InlineSpinner from "@/components/InlineSpinner";
import { clientFetch } from "@/lib/clientFetch";
import { fmtCurrency } from "@/lib/currencyFormat";
import {
  ORDER_SNAPSHOT_DIFF_FIELDS,
  getChangedOrderSnapshotFields,
  type OrderSnapshotFieldKind,
} from "@/lib/orderSnapshotDiff";
import type { OrderLedgerChangeRequest, OrderLedgerEntry, OrderLedgerSnapshotJson } from "@/lib/types";

type Props = {
  currencySymbol: string;
  refreshSignal: number;
  onMutated?: () => void;
  onOrderApplied?: () => void;
};

function fmtCell(currencySymbol: string, kind: OrderSnapshotFieldKind, v: unknown): string {
  if (kind === "bool") return v ? "Yes" : "No";
  if (kind === "money") {
    const n = Number(v);
    return Number.isFinite(n) ? fmtCurrency(currencySymbol, n) : "—";
  }
  if (kind === "number") {
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : "—";
  }
  if (kind === "date") return String(v ?? "").slice(0, 10) || "—";
  const s = String(v ?? "").trim();
  return s || "—";
}

export default function OrderApprovalsPanel({ currencySymbol, refreshSignal, onMutated, onOrderApplied }: Props) {
  const [newOrders, setNewOrders] = useState<OrderLedgerEntry[]>([]);
  const [editReqs, setEditReqs] = useState<OrderLedgerChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [expandedEditId, setExpandedEditId] = useState<string | null>(null);

  const load = useCallback(async (soft: boolean) => {
    if (!soft || !loaded.current) setLoading(true);
    try {
      const [or, er] = await Promise.all([
        clientFetch("/api/order-ledger", { cache: "no-store" }),
        clientFetch("/api/order-ledger-change-requests", { cache: "no-store" }),
      ]);
      const od = await or.json();
      const ed = await er.json();
      if (!or.ok) {
        toast.error(
          or.status === 401 ? "Session expired or not signed in. Refresh and sign in again." : od.error || "Could not load orders.",
        );
        return;
      }
      if (!er.ok) {
        toast.error(
          er.status === 401 ? "Session expired or not signed in. Refresh and sign in again." : ed.error || "Could not load edit requests.",
        );
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
      const res = await clientFetch(`/api/order-ledger/${o.id}/approval`, {
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
      const res = await clientFetch(`/api/order-ledger/${o.id}/approval`, {
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
      const res = await clientFetch(`/api/order-ledger-change-requests/${r.id}`, {
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
      setExpandedEditId(null);
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
      const res = await clientFetch(`/api/order-ledger-change-requests/${r.id}`, {
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
      setExpandedEditId(null);
      void load(true);
    } catch {
      toast.error("Could not reject.");
    } finally {
      setBusy(null);
    }
  };

  const renderEditDiffRows = (prev: OrderLedgerSnapshotJson, next: OrderLedgerSnapshotJson) => {
    const changed = getChangedOrderSnapshotFields(prev, next);
    const rows = changed.length > 0 ? changed : ORDER_SNAPSHOT_DIFF_FIELDS;
    return rows.map(({ key, label, kind }) => (
      <tr key={key}>
        <td>{label}</td>
        <td className="order-td-wrap">{fmtCell(currencySymbol, kind, prev[key])}</td>
        <td className="order-td-wrap">{fmtCell(currencySymbol, kind, next[key])}</td>
      </tr>
    ));
  };

  const pendingCount = newOrders.length + editReqs.length;

  return (
    <section className="card">
      <h2>Order approvals</h2>
      <p className="calc-lead muted" style={{ marginBottom: 12 }}>
        {loading && !loaded.current ? "Loading…" : `${pendingCount} pending (new orders + edits).`}
      </p>

      <h3 style={{ fontSize: 15, marginBottom: 8 }}>New orders</h3>
      <div className="design-table-wrap">
        <table className="design-table design-table--approval">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Phone</th>
              <th>Tracking</th>
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
                  <td style={{ fontSize: 12 }}>{o.customer_phone?.trim() || "—"}</td>
                  <td className="order-td-wrap" style={{ fontSize: 12, maxWidth: 120 }}>
                    {o.shipment_tracking?.trim() || "—"}
                  </td>
                  <td className="amt">{fmtCurrency(currencySymbol, Number(o.net_profit))}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {o.created_by}
                  </td>
                  <td>
                    <div className="design-table-actions">
                      <button type="button" disabled={busy === o.id} onClick={() => void approveNew(o)}>
                        {busy === o.id ? (
                          <>
                            <InlineSpinner /> …
                          </>
                        ) : (
                          "Approve"
                        )}
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
      <p className="muted" style={{ margin: "0 0 10px", fontSize: 12, lineHeight: 1.45 }}>
        Each row lists every field that differs from the current order. Expand to see a full before/after table for that request.
      </p>
      <div className="design-table-wrap">
        <table className="design-table design-table--approval">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Changes</th>
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
              editReqs.map((r) => {
                const prev = r.previous_snapshot;
                const next = r.proposed_snapshot;
                const changed = getChangedOrderSnapshotFields(prev, next);
                const summary =
                  changed.length === 0
                    ? "No differences detected (compare snapshots below)."
                    : `${changed.length} field${changed.length === 1 ? "" : "s"}: ${changed.map((c) => c.label).join(", ")}`;
                return (
                  <tr key={r.id}>
                    <td style={{ fontSize: 12 }}>{r.proposed_snapshot.order_uid}</td>
                    <td style={{ fontSize: 12, lineHeight: 1.4, whiteSpace: "normal", maxWidth: 280 }}>
                      <div>{summary}</div>
                      <div className="muted" style={{ marginTop: 4 }}>
                        Total {fmtCurrency(currencySymbol, prev.total_cost_price)} → {fmtCurrency(currencySymbol, next.total_cost_price)} · Net{" "}
                        {fmtCurrency(currencySymbol, prev.net_profit)} → {fmtCurrency(currencySymbol, next.net_profit)}
                      </div>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ marginTop: 8, padding: "6px 10px", fontSize: 12 }}
                        onClick={() => setExpandedEditId((id) => (id === r.id ? null : r.id))}
                      >
                        {expandedEditId === r.id ? "Hide diff" : "View full diff"}
                      </button>
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {r.requested_by}
                    </td>
                    <td>
                      <div className="design-table-actions">
                        <button type="button" disabled={busy === r.id} onClick={() => void approveEdit(r)}>
                          {busy === r.id ? (
                            <>
                              <InlineSpinner /> …
                            </>
                          ) : (
                            "Approve"
                          )}
                        </button>
                        <button className="delete" type="button" disabled={busy === r.id} onClick={() => void rejectEdit(r)}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {expandedEditId ? (
        <div className="card" style={{ marginTop: 14, padding: 14 }}>
          {(() => {
            const r = editReqs.find((x) => x.id === expandedEditId);
            if (!r) return null;
            const prev = r.previous_snapshot;
            const next = r.proposed_snapshot;
            const changed = getChangedOrderSnapshotFields(prev, next);
            return (
              <>
                <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>
                  {changed.length > 0 ? `Changed fields (${changed.length})` : "Full snapshot compare"}
                </h3>
                <p className="muted" style={{ margin: "0 0 10px", fontSize: 12 }}>
                  {changed.length > 0
                    ? "Only values that differ are listed. Money values use your currency symbol."
                    : "Showing all tracked fields because no differences were detected by the comparator."}
                </p>
                <div className="design-table-wrap">
                  <table className="design-table design-table--approval design-table--diff">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Previous</th>
                        <th>Proposed</th>
                      </tr>
                    </thead>
                    <tbody>{renderEditDiffRows(prev, next)}</tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      ) : null}
    </section>
  );
}
