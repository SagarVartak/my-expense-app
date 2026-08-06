"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import type { CostDesign, PrintedInventoryDesignRow, SessionUser } from "@/lib/types";
import { clientFetch } from "@/lib/clientFetch";

function fmtShortDate(iso: string | null) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

type Props = {
  refreshSignal: number;
  onMutated?: () => void;
};

export default function PrintedInventory({ refreshSignal, onMutated }: Props) {
  const [rows, setRows] = useState<PrintedInventoryDesignRow[]>([]);
  const [designs, setDesigns] = useState<CostDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);
  const [saving, setSaving] = useState(false);
  const [costDesignId, setCostDesignId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [printerName, setPrinterName] = useState("");
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  const load = useCallback(async (soft: boolean) => {
    if (!soft || !loaded.current) setLoading(true);
    try {
      const [invRes, dRes, userRes] = await Promise.all([
        fetch("/api/printed-inventory", { cache: "no-store" }),
        fetch("/api/cost-designs", { cache: "no-store" }),
        clientFetch("/api/auth/me", { cache: "no-store" }),
      ]);
      const inv = await invRes.json();
      const dJson = await dRes.json();
      if (!invRes.ok) {
        toast.error(inv.error || "Could not load inventory.");
        return;
      }
      if (dRes.ok) {
        setDesigns((dJson.designs || []) as CostDesign[]);
      }
      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentUser(userData.user);
      }
      setRows((inv.rows || []) as PrintedInventoryDesignRow[]);
      loaded.current = true;
    } catch {
      toast.error("Could not load inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(loaded.current);
  }, [refreshSignal, load]);

  const handleLogPrint = async () => {
    const id = costDesignId.trim();
    const q = Math.floor(Number.parseInt(quantity, 10));
    if (!id) {
      toast.error("Select a saved design.");
      return;
    }
    if (!Number.isFinite(q) || q < 1) {
      toast.error("Enter a positive quantity.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/printed-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cost_design_id: id,
          quantity: q,
          printer_name: printerName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not save.");
        return;
      }
      toast.success("Print run logged.");
      setQuantity("");
      setPrinterName("");
      onMutated?.();
      void load(true);
    } catch {
      toast.error("Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const canManageInventory = currentUser?.role === "admin" || currentUser?.role === "manager";

  const handleDeleteEntry = async (entryId: string) => {
    if (!window.confirm("Delete this inventory entry?")) return;
    try {
      const res = await fetch(`/api/printed-inventory/${entryId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not delete.");
        return;
      }
      toast.success("Entry deleted.");
      onMutated?.();
      void load(true);
    } catch {
      toast.error("Could not delete.");
    }
  };

  const withStock = rows.filter((r) => r.total_printed > 0);
  const totalUnits = rows.reduce((s, r) => s + r.total_printed, 0);

  return (
    <>
      <section className="card">
        <h2>Log a print run</h2>
        <p className="calc-lead muted" style={{ marginBottom: 12 }}>
          Record units printed from a saved design. When an admin approves an order, that many units are subtracted
          for that design (see Order Ledger). The table below shows net stock: prints minus approved orders.
        </p>
        <div className="row3">
          <div>
            <label htmlFor="inv-design">Saved design</label>
            <select
              id="inv-design"
              value={costDesignId}
              onChange={(e) => setCostDesignId(e.target.value)}
              disabled={designs.length === 0}
            >
              <option value="">{designs.length === 0 ? "No designs yet" : "Select design"}</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.keychain_design}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="inv-qty">Quantity printed</label>
            <input
              id="inv-qty"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder="e.g. 10"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="inv-printer">Printer (optional)</label>
            <input
              id="inv-printer"
              type="text"
              placeholder="e.g. Ender 3"
              value={printerName}
              onChange={(e) => setPrinterName(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="btnbar" style={{ marginTop: 14 }}>
          <button type="button" onClick={() => void handleLogPrint()} disabled={saving || designs.length === 0}>
            {saving ? "Saving…" : "Add to inventory"}
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Printed inventory (net)</h2>
        <p className="calc-lead muted" style={{ marginBottom: 12 }}>
          {loading && !loaded.current
            ? "Loading…"
            : `${rows.length} saved design${rows.length === 1 ? "" : "s"} · ${totalUnits} net unit${totalUnits === 1 ? "" : "s"} (prints − orders) · ${withStock.length} design${withStock.length === 1 ? "" : "s"} with positive stock.`}
        </p>
        <div className="design-table-wrap">
          <table className="design-table">
            <thead>
              <tr>
                <th className="design-th-design">Design</th>
                <th className="amt">Net qty</th>
                <th>Coloured</th>
                <th>Last printer</th>
                <th>Last print</th>
                {canManageInventory ? <th className="design-th-action">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading && !loaded.current ? (
                <tr>
                  <td colSpan={canManageInventory ? 6 : 5} className="muted">
                    Loading inventory…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={canManageInventory ? 6 : 5} className="muted">
                    No saved designs. Add designs under Cost Price Calculator first.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const design = designs.find((d) => d.id === r.cost_design_id);
                  const isColoured = (design?.colour_cost ?? 0) > 0;
                  return (
                    <tr key={r.cost_design_id}>
                      <td style={{ maxWidth: 220 }} title={r.keychain_design}>
                        <span className="design-name-cell">{r.keychain_design}</span>
                      </td>
                      <td className="amt">{r.total_printed}</td>
                      <td style={{ textAlign: "center" }}>
                        {isColoured ? (
                          <span style={{ color: "#7dffc4" }}>● Coloured</span>
                        ) : (
                          <span className="muted">○ Plain</span>
                        )}
                      </td>
                      <td className="muted" style={{ fontSize: 13 }}>
                        {r.last_printer_name?.trim() ? r.last_printer_name : "—"}
                      </td>
                      <td className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                        {fmtShortDate(r.last_print_at)}
                      </td>
                      {canManageInventory ? (
                        <td>
                          <div className="design-table-actions">
                            <button
                              className="delete"
                              type="button"
                              onClick={() => void handleDeleteEntry(r.cost_design_id)}
                              title="Delete all entries for this design"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
