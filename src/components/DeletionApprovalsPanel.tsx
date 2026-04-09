"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import InlineSpinner from "@/components/InlineSpinner";
import { clientFetch } from "@/lib/clientFetch";
import { fmtCurrency } from "@/lib/currencyFormat";
import type { DeletionRequest, DeletionResourceType } from "@/lib/types";

type Props = {
  currencySymbol: string;
  refreshSignal: number;
  onMutated?: () => void;
};

function resourceLabel(t: DeletionResourceType): string {
  if (t === "expense") return "Expense";
  if (t === "cost_design") return "Cost design";
  return "Order";
}

function summarize(r: DeletionRequest, currencySymbol: string): string {
  const p = r.payload || {};
  if (r.resource_type === "expense") {
    const uid = String(p.entry_uid ?? "").trim();
    const amt = Number(p.amount);
    return `${uid || "entry"} · ${fmtCurrency(currencySymbol, amt)} · ${String(p.category ?? "")} (${String(p.paid_by ?? "")})`;
  }
  if (r.resource_type === "cost_design") {
    return `"${String(p.keychain_design ?? "")}" · total ${fmtCurrency(currencySymbol, Number(p.total_cost_price))} · by ${String(p.created_by ?? "")}`;
  }
  return `${String(p.order_uid ?? "")} · ${String(p.customer_name ?? "")} · ${fmtCurrency(currencySymbol, Number(p.net_profit))} · by ${String(p.created_by ?? "")}`;
}

export default function DeletionApprovalsPanel({ currencySymbol, refreshSignal, onMutated }: Props) {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (soft: boolean) => {
    if (!soft || !loaded.current) setLoading(true);
    try {
      const res = await clientFetch("/api/deletion-requests?scope=all", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(
          res.status === 401 ? "Session expired or not signed in. Refresh and sign in again." : data.error || "Could not load deletion requests.",
        );
        return;
      }
      setRequests(((data.requests || []) as DeletionRequest[]).filter((r) => r.status === "pending"));
      loaded.current = true;
    } catch {
      toast.error("Could not load deletion requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(loaded.current);
  }, [refreshSignal, load]);

  const approve = async (r: DeletionRequest) => {
    if (!window.confirm(`Permanently delete this ${resourceLabel(r.resource_type).toLowerCase()}?`)) return;
    setBusy(r.id);
    try {
      const res = await clientFetch(`/api/deletion-requests/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not approve.");
        return;
      }
      toast.success("Deletion approved.");
      onMutated?.();
      void load(true);
    } catch {
      toast.error("Could not approve.");
    } finally {
      setBusy(null);
    }
  };

  const reject = async (r: DeletionRequest) => {
    const reason = window.prompt("Reject reason (optional):") ?? "";
    setBusy(r.id);
    try {
      const res = await clientFetch(`/api/deletion-requests/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reject_reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not reject.");
        return;
      }
      toast.info("Deletion request rejected.");
      onMutated?.();
      void load(true);
    } catch {
      toast.error("Could not reject.");
    } finally {
      setBusy(null);
    }
  };

  const n = requests.length;

  return (
    <section className="card">
      <h2>Deletion requests</h2>
      <p className="calc-lead muted" style={{ marginBottom: 12 }}>
        {loading && !loaded.current ? "Loading…" : `${n} pending deletion${n === 1 ? "" : "s"}.`}
      </p>

      <div className="design-table-wrap">
        <table className="design-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Summary</th>
              <th>Requested by</th>
              <th className="design-th-action">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No pending deletion requests.
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{resourceLabel(r.resource_type)}</td>
                  <td style={{ fontSize: 12 }}>{summarize(r, currencySymbol)}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {r.requested_by}
                  </td>
                  <td>
                    <div className="design-table-actions">
                      <button type="button" disabled={busy === r.id} onClick={() => void approve(r)}>
                        {busy === r.id ? (
                          <>
                            <InlineSpinner /> …
                          </>
                        ) : (
                          "Approve"
                        )}
                      </button>
                      <button className="delete" type="button" disabled={busy === r.id} onClick={() => void reject(r)}>
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
