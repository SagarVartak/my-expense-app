"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import DecimalCostInput from "@/components/DecimalCostInput";
import { computeTotalCostPrice } from "@/lib/costDesignCalc";
import { fmtCurrency } from "@/lib/currencyFormat";
import type { CostDesign } from "@/lib/types";

type Props = {
  open: boolean;
  design: CostDesign | null;
  currencySymbol: string;
  onClose: () => void;
  /** Submits a change request; an admin must approve before the database updates. */
  onRequestSubmitted?: () => void;
};

function parseN(s: string): number {
  const x = parseFloat(String(s).replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

export default function EditCostDesignModal({ open, design, currencySymbol, onClose, onRequestSubmitted }: Props) {
  const [keychainDesign, setKeychainDesign] = useState("");
  const [printWeightG, setPrintWeightG] = useState("");
  const [filamentCostPerG, setFilamentCostPerG] = useState("");
  const [electricityFee, setElectricityFee] = useState("");
  const [chainCost, setChainCost] = useState("");
  const [pouchCost, setPouchCost] = useState("");
  const [cardCost, setCardCost] = useState("");
  const [primerCost, setPrimerCost] = useState("");
  const [clearcoatCost, setClearcoatCost] = useState("");
  const [keyCapsCost, setKeyCapsCost] = useState("");
  const [colourCost, setColourCost] = useState("");
  const [shipping, setShipping] = useState("");
  const [saving, setSaving] = useState(false);

  const prevOpenRef = useRef(false);
  const lastSyncedDesignIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !design) {
      if (!open) {
        prevOpenRef.current = false;
        lastSyncedDesignIdRef.current = null;
      }
      return;
    }
    const openedNow = open && !prevOpenRef.current;
    const idChanged = lastSyncedDesignIdRef.current !== design.id;
    prevOpenRef.current = open;
    if (!openedNow && !idChanged) return;
    lastSyncedDesignIdRef.current = design.id;

    setKeychainDesign(design.keychain_design ?? "");
    setPrintWeightG(String(design.print_weight_g ?? ""));
    setFilamentCostPerG(String(design.filament_cost_per_g ?? ""));
    setElectricityFee(String(design.electricity_fee ?? ""));
    setChainCost(String(design.chain_cost ?? ""));
    setPouchCost(String(design.pouch_cost ?? ""));
    setCardCost(String(design.card_cost ?? ""));
    setPrimerCost(String(design.primer_cost ?? ""));
    setClearcoatCost(String(design.clearcoat_cost ?? ""));
    setKeyCapsCost(String(design.key_caps_cost ?? ""));
    setColourCost(String(design.colour_cost ?? ""));
    setShipping(String(design.shipping ?? ""));
  }, [open, design]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filamentLineCost = useMemo(
    () => parseN(printWeightG) * parseN(filamentCostPerG),
    [printWeightG, filamentCostPerG],
  );

  const totalCostPrice = useMemo(
    () =>
      computeTotalCostPrice({
        print_weight_g: parseN(printWeightG),
        filament_cost_per_g: parseN(filamentCostPerG),
        electricity_fee: parseN(electricityFee),
        chain_cost: parseN(chainCost),
        pouch_cost: parseN(pouchCost),
        card_cost: parseN(cardCost),
        primer_cost: parseN(primerCost),
        clearcoat_cost: parseN(clearcoatCost),
        key_caps_cost: parseN(keyCapsCost),
        colour_cost: parseN(colourCost),
        shipping: parseN(shipping),
      }),
    [printWeightG, filamentCostPerG, electricityFee, chainCost, pouchCost, cardCost, primerCost, clearcoatCost, keyCapsCost, colourCost, shipping],
  );

  const fmt = (n: number) => fmtCurrency(currencySymbol, n);

  const handleSubmit = async () => {
    if (!design) return;
    const name = keychainDesign.trim();
    if (!name) {
      toast.error("Enter a keychain design name.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/cost-designs/${design.id}/change-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keychain_design: name,
          print_weight_g: parseN(printWeightG),
          filament_cost_per_g: parseN(filamentCostPerG),
          electricity_fee: parseN(electricityFee),
          chain_cost: parseN(chainCost),
          pouch_cost: parseN(pouchCost),
          card_cost: parseN(cardCost),
          primer_cost: parseN(primerCost),
          clearcoat_cost: parseN(clearcoatCost),
          key_caps_cost: parseN(keyCapsCost),
          colour_cost: parseN(colourCost),
          shipping: parseN(shipping),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not submit change request.");
        return;
      }
      toast.success("Change request sent. An admin can approve it under Approvals → Design changes.");
      onRequestSubmitted?.();
      onClose();
    } catch {
      toast.error("Could not update design.");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !design) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-overlay modal-overlay--portal"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-panel modal-panel--wide modal-panel--account card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-cost-design-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="edit-cost-design-title" style={{ margin: "0 0 6px", fontSize: 18 }}>
          Edit saved design
        </h2>
        <p className="muted" style={{ margin: "0 0 14px", fontSize: 13 }}>
          Adjust weights and costs when prices change. Your changes are submitted for <strong>admin approval</strong>{" "}
          before they apply. Total cost is recalculated like the calculator.
        </p>

        <div style={{ marginTop: 8 }}>
          <label htmlFor="ecd-design">Keychain design</label>
          <input
            id="ecd-design"
            type="text"
            value={keychainDesign}
            onChange={(e) => setKeychainDesign(e.target.value)}
            autoComplete="off"
          />
        </div>

        <h3 className="calc-section-title" style={{ marginTop: 16 }}>
          Print &amp; material
        </h3>
        <div className="row3">
          <div>
            <label htmlFor="ecd-weight">Print weight (g)</label>
            <DecimalCostInput id="ecd-weight" value={printWeightG} onValueChange={setPrintWeightG} />
          </div>
          <div>
            <label htmlFor="ecd-filament">Filament cost per (g)</label>
            <DecimalCostInput id="ecd-filament" value={filamentCostPerG} onValueChange={setFilamentCostPerG} />
          </div>
          <div>
            <label htmlFor="ecd-electricity">Electricity fee</label>
            <DecimalCostInput id="ecd-electricity" value={electricityFee} onValueChange={setElectricityFee} />
          </div>
        </div>
        <p className="muted calc-filament-line">
          Filament line: {fmt(filamentLineCost)} <span className="calc-dim">(weight × cost per g)</span>
        </p>

        <h3 className="calc-section-title">Packaging &amp; finish</h3>
        <div className="row3">
          <div>
            <label htmlFor="ecd-chain">Chain cost</label>
            <DecimalCostInput id="ecd-chain" value={chainCost} onValueChange={setChainCost} />
          </div>
          <div>
            <label htmlFor="ecd-pouch">Pouch cost</label>
            <DecimalCostInput id="ecd-pouch" value={pouchCost} onValueChange={setPouchCost} />
          </div>
          <div>
            <label htmlFor="ecd-card">Card cost</label>
            <DecimalCostInput id="ecd-card" value={cardCost} onValueChange={setCardCost} />
          </div>
        </div>
        <div className="row3" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="ecd-primer">Primer cost</label>
            <DecimalCostInput id="ecd-primer" value={primerCost} onValueChange={setPrimerCost} />
          </div>
          <div>
            <label htmlFor="ecd-clearcoat">Clearcoat cost</label>
            <DecimalCostInput id="ecd-clearcoat" value={clearcoatCost} onValueChange={setClearcoatCost} />
          </div>
          <div>
            <label htmlFor="ecd-keycaps">Key caps</label>
            <DecimalCostInput id="ecd-keycaps" value={keyCapsCost} onValueChange={setKeyCapsCost} />
          </div>
        </div>
        <div className="row3" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="ecd-colour">Colour cost</label>
            <DecimalCostInput id="ecd-colour" value={colourCost} onValueChange={setColourCost} placeholder="0 (for coloured keychains)" />
          </div>
          <div aria-hidden />
          <div aria-hidden />
        </div>
        <div className="row3" style={{ marginTop: 10 }}>
          <div className="span-row3">
            <label htmlFor="ecd-shipping">Shipping</label>
            <DecimalCostInput id="ecd-shipping" value={shipping} onValueChange={setShipping} />
          </div>
        </div>

        <h3 className="calc-section-title">Total</h3>
        <div className="calc-summary calc-summary--single">
          <div>
            <div className="calc-summary-label">Total cost price</div>
            <div className="calc-summary-value">{fmt(totalCostPrice)}</div>
          </div>
        </div>

        <div className="btnbar" style={{ marginTop: 16 }}>
          <button type="button" onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Submitting…" : "Submit for approval"}
          </button>
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
