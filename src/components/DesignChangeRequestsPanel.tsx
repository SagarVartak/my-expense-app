"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import InlineSpinner from "@/components/InlineSpinner";
import { clientFetch } from "@/lib/clientFetch";
import { fmtCurrency } from "@/lib/currencyFormat";
import type { CostDesignChangeRequest } from "@/lib/types";

const DIFF_FIELDS: { key: keyof import("@/lib/types").CostDesignSnapshotJson; label: string; money?: boolean }[] = [
  { key: "keychain_design", label: "Design name" },
  { key: "print_weight_g", label: "Print weight (g)" },
  { key: "filament_cost_per_g", label: "Filament /g", money: true },
  { key: "electricity_fee", label: "Electricity", money: true },
  { key: "chain_cost", label: "Chain", money: true },
  { key: "pouch_cost", label: "Pouch", money: true },
  { key: "card_cost", label: "Card", money: true },
  { key: "primer_cost", label: "Primer", money: true },
  { key: "clearcoat_cost", label: "Clearcoat", money: true },
  { key: "key_caps_cost", label: "Key caps", money: true },
  { key: "shipping", label: "Shipping", money: true },
  { key: "total_cost_price", label: "Total cost", money: true },
];

type Props = {
  currencySymbol: string;
  refreshSignal: number;
  onMutated?: () => void;
  /** Call when a request is approved so saved designs reload. */
  onApplied?: () => void;
};

function fmtVal(
  currencySymbol: string,
  key: keyof import("@/lib/types").CostDesignSnapshotJson,
  v: unknown,
  money?: boolean,
): string {
  if (key === "keychain_design") return String(v ?? "");
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (money) return fmtCurrency(currencySymbol, n);
  return String(n);
}

export default function DesignChangeRequestsPanel({ currencySymbol, refreshSignal, onMutated, onApplied }: Props) {
  const [requests, setRequests] = useState<CostDesignChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async (soft: boolean) => {
    if (!soft || !loaded.current) setLoading(true);
    try {
      const res = await clientFetch("/api/cost-design-change-requests", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(
          res.status === 401 ? "Session expired or not signed in. Refresh and sign in again." : data.error || "Could not load change requests.",
        );
        return;
      }
      setRequests((data.requests || []) as CostDesignChangeRequest[]);
      loaded.current = true;
    } catch {
      toast.error("Could not load change requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(loaded.current);
  }, [refreshSignal, load]);

  const approve = async (r: CostDesignChangeRequest) => {
    if (!window.confirm(`Apply proposed values to "${r.proposed_snapshot.keychain_design}"?`)) return;
    setBusyId(r.id);
    try {
      const res = await clientFetch(`/api/cost-design-change-requests/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not approve.");
        return;
      }
      toast.success("Change approved and applied.");
      onApplied?.();
      onMutated?.();
      void load(true);
    } catch {
      toast.error("Could not approve.");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (r: CostDesignChangeRequest) => {
    const reason = window.prompt("Reject reason (optional):") ?? "";
    setBusyId(r.id);
    try {
      const res = await clientFetch(`/api/cost-design-change-requests/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", reject_reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not reject.");
        return;
      }
      toast.info("Change request rejected.");
      onMutated?.();
      void load(true);
    } catch {
      toast.error("Could not reject.");
    } finally {
      setBusyId(null);
    }
  };

  const pending = requests.filter((x) => x.status === "pending");

  return (
    <section className="card">
      <h2>Design change requests</h2>
      <p className="calc-lead muted" style={{ marginBottom: 12 }}>
        {loading && !loaded.current
          ? "Loading…"
          : `${pending.length} pending · ${requests.length} total in view (newest first).`}
      </p>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Edits from <strong>Saved designs → Edit</strong> stay in the database only after you approve. Previous and
        proposed values are stored on each request for the audit log.
      </p>

      <div className="design-table-wrap">
        <table className="design-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Design (proposed)</th>
              <th className="amt">Total before → after</th>
              <th>Requested by</th>
              <th>When</th>
              <th>Review</th>
              <th className="design-th-action">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && !loaded.current ? (
              <tr>
                <td colSpan={7} className="muted">
                  Loading…
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No change requests yet.
                </td>
              </tr>
            ) : (
              requests.map((r) => {
                const prev = r.previous_snapshot;
                const next = r.proposed_snapshot;
                const isOpen = expanded === r.id;
                return (
                  <tr key={r.id}>
                    <td>
                      <span
                        className={
                          r.status === "pending"
                            ? "pill"
                            : r.status === "approved"
                              ? "muted"
                              : "muted"
                        }
                        style={
                          r.status === "pending"
                            ? { borderColor: "rgba(240, 180, 41, 0.45)", color: "#f0d090" }
                            : undefined
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td style={{ maxWidth: 160 }}>
                      <span className="design-name-cell" title={next.keychain_design}>
                        {next.keychain_design}
                      </span>
                    </td>
                    <td className="amt" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                      {fmtCurrency(currencySymbol, prev.total_cost_price)} → {fmtCurrency(currencySymbol, next.total_cost_price)}
                    </td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {r.requested_by}
                    </td>
                    <td className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                      {new Date(r.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="muted" style={{ fontSize: 11 }}>
                      {r.status === "pending"
                        ? "—"
                        : `${r.reviewed_by ?? "—"}${r.reviewed_at ? ` · ${new Date(r.reviewed_at).toLocaleDateString()}` : ""}`}
                      {r.status === "rejected" && r.reject_reason ? (
                        <div style={{ marginTop: 4 }} title={r.reject_reason}>
                          Reason: {r.reject_reason.length > 40 ? `${r.reject_reason.slice(0, 40)}…` : r.reject_reason}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <div className="design-table-actions">
                        <button type="button" onClick={() => setExpanded(isOpen ? null : r.id)}>
                          {isOpen ? "Hide diff" : "View diff"}
                        </button>
                        {r.status === "pending" ? (
                          <>
                            <button type="button" disabled={busyId === r.id} onClick={() => void approve(r)}>
                              {busyId === r.id ? (
                                <>
                                  <InlineSpinner /> …
                                </>
                              ) : (
                                "Approve"
                              )}
                            </button>
                            <button
                              className="delete"
                              type="button"
                              disabled={busyId === r.id}
                              onClick={() => void reject(r)}
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {expanded ? (
        <div className="card" style={{ marginTop: 14, padding: 14 }}>
          {(() => {
            const r = requests.find((x) => x.id === expanded);
            if (!r) return null;
            const prev = r.previous_snapshot;
            const next = r.proposed_snapshot;
            return (
              <>
                <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Field-by-field diff</h3>
                <div className="design-table-wrap">
                  <table className="design-table design-table--approval design-table--diff">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Previous</th>
                        <th>Proposed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {DIFF_FIELDS.map(({ key, label, money }) => (
                        <tr key={key}>
                          <td>{label}</td>
                          <td className="order-td-wrap">{fmtVal(currencySymbol, key, prev[key], money)}</td>
                          <td className="order-td-wrap">{fmtVal(currencySymbol, key, next[key], money)}</td>
                        </tr>
                      ))}
                    </tbody>
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
