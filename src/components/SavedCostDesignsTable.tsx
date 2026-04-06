"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import EditCostDesignModal from "@/components/EditCostDesignModal";
import { fmtCurrency } from "@/lib/currencyFormat";
import type { CostDesign, SessionUser } from "@/lib/types";

function fmtShortDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

type Props = {
  currencySymbol: string;
  currentUser: SessionUser;
  /** From header refresh (increment to reload). */
  refreshSignal: number;
  /** Increment when a design is saved from the calculator (reloads list). */
  saveBump?: number;
  /** Called after a design is deleted (e.g. refresh admin audit log). */
  onCostDesignMutated?: () => void;
  /** After a cost edit is submitted for admin approval (not yet applied). */
  onChangeRequestSubmitted?: () => void;
  emptyHint?: string;
};

export default function SavedCostDesignsTable({
  currencySymbol,
  currentUser,
  refreshSignal,
  saveBump = 0,
  onCostDesignMutated,
  onChangeRequestSubmitted,
  emptyHint = 'No designs yet. Fill the form on Cost Price Calculator and click "Add design".',
}: Props) {
  const [designs, setDesigns] = useState<CostDesign[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const hasLoadedOnce = useRef(false);
  const [editing, setEditing] = useState<CostDesign | null>(null);

  const loadDesigns = useCallback(async (soft: boolean) => {
    if (!soft || !hasLoadedOnce.current) setLoadingList(true);
    try {
      const res = await fetch("/api/cost-designs", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not load saved designs.");
        return;
      }
      setDesigns((data.designs || []) as CostDesign[]);
      hasLoadedOnce.current = true;
    } catch {
      toast.error("Could not load saved designs.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadDesigns(hasLoadedOnce.current);
  }, [refreshSignal, saveBump, loadDesigns]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/cost-designs/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not delete.");
        return;
      }
      toast.success("Design removed.");
      setDesigns((prev) => prev.filter((d) => d.id !== id));
      onCostDesignMutated?.();
    } catch {
      toast.error("Could not delete.");
    }
  };

  const canDeleteRow = (createdBy: string) =>
    currentUser.role === "admin" || createdBy === currentUser.username;

  return (
    <section className="card">
      <EditCostDesignModal
        open={editing !== null}
        design={editing}
        currencySymbol={currencySymbol}
        onClose={() => setEditing(null)}
        onRequestSubmitted={() => {
          onChangeRequestSubmitted?.();
          onCostDesignMutated?.();
        }}
      />
      <h2>Saved designs</h2>
      <p className="calc-lead muted" style={{ marginBottom: 12 }}>
        {loadingList && !hasLoadedOnce.current ? "Loading…" : `${designs.length} saved in the database.`}
      </p>
      <div className="design-table-wrap">
        <table className="design-table">
          <thead>
            <tr>
              <th className="design-th-design">Keychain design</th>
              <th className="amt">Print weight (g)</th>
              <th className="amt">Filament cost per (g)</th>
              <th className="amt">Electricity fee</th>
              <th className="amt">Chain cost</th>
              <th className="amt">Pouch cost</th>
              <th className="amt">Card cost</th>
              <th className="amt">Primer cost</th>
              <th className="amt">Clearcoat cost</th>
              <th className="amt">Key caps</th>
              <th className="amt">Shipping</th>
              <th className="amt">Total cost price</th>
              <th>Saved by</th>
              <th>Saved at</th>
              <th className="design-th-action">Action</th>
            </tr>
          </thead>
          <tbody>
            {loadingList && !hasLoadedOnce.current ? (
              <tr>
                <td colSpan={15} className="muted">
                  Loading saved designs…
                </td>
              </tr>
            ) : designs.length === 0 ? (
              <tr>
                <td colSpan={15} className="muted">
                  {emptyHint}
                </td>
              </tr>
            ) : (
              designs.map((d) => (
                <tr key={d.id}>
                  <td style={{ maxWidth: 160 }} title={d.keychain_design}>
                    <span className="design-name-cell">{d.keychain_design}</span>
                  </td>
                  <td className="amt">{Number(d.print_weight_g).toFixed(2)}</td>
                  <td className="amt">{fmtCurrency(currencySymbol, Number(d.filament_cost_per_g))}</td>
                  <td className="amt">{fmtCurrency(currencySymbol, Number(d.electricity_fee))}</td>
                  <td className="amt">{fmtCurrency(currencySymbol, Number(d.chain_cost))}</td>
                  <td className="amt">{fmtCurrency(currencySymbol, Number(d.pouch_cost))}</td>
                  <td className="amt">{fmtCurrency(currencySymbol, Number(d.card_cost))}</td>
                  <td className="amt">{fmtCurrency(currencySymbol, Number(d.primer_cost))}</td>
                  <td className="amt">{fmtCurrency(currencySymbol, Number(d.clearcoat_cost))}</td>
                  <td className="amt">{fmtCurrency(currencySymbol, Number(d.key_caps_cost ?? 0))}</td>
                  <td className="amt">{fmtCurrency(currencySymbol, Number(d.shipping))}</td>
                  <td className="amt">{fmtCurrency(currencySymbol, Number(d.total_cost_price))}</td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>
                    {d.created_by}
                  </td>
                  <td className="muted" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                    {fmtShortDate(d.created_at)}
                  </td>
                  <td>
                    <div className="design-table-actions">
                      <button type="button" onClick={() => setEditing(d)}>
                        Edit
                      </button>
                      {canDeleteRow(d.created_by) ? (
                        <button className="delete" type="button" onClick={() => void handleDelete(d.id)}>
                          Delete
                        </button>
                      ) : null}
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
