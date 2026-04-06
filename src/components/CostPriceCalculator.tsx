"use client";

import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import SavedCostDesignsTable, { fmtMoney } from "@/components/SavedCostDesignsTable";
import type { SessionUser } from "@/lib/types";

type Props = {
  currencySymbol: string;
  currentUser: SessionUser;
  refreshSignal: number;
  /** Called after a design is saved (e.g. refresh admin audit log). */
  onCostDesignMutated?: () => void;
};

function parseN(s: string): number {
  const x = parseFloat(String(s).replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

export default function CostPriceCalculator({
  currencySymbol,
  currentUser,
  refreshSignal,
  onCostDesignMutated,
}: Props) {
  const [keychainDesign, setKeychainDesign] = useState("");
  const [printWeightG, setPrintWeightG] = useState("");
  const [filamentCostPerG, setFilamentCostPerG] = useState("");
  const [electricityFee, setElectricityFee] = useState("");
  const [chainCost, setChainCost] = useState("");
  const [pouchCost, setPouchCost] = useState("");
  const [cardCost, setCardCost] = useState("");
  const [primerCost, setPrimerCost] = useState("");
  const [clearcoatCost, setClearcoatCost] = useState("");
  const [shipping, setShipping] = useState("");
  const [saveBump, setSaveBump] = useState(0);

  const [saving, setSaving] = useState(false);

  const filamentLineCost = useMemo(
    () => parseN(printWeightG) * parseN(filamentCostPerG),
    [printWeightG, filamentCostPerG],
  );

  const totalCostPrice = useMemo(
    () =>
      filamentLineCost +
      parseN(electricityFee) +
      parseN(chainCost) +
      parseN(pouchCost) +
      parseN(cardCost) +
      parseN(primerCost) +
      parseN(clearcoatCost) +
      parseN(shipping),
    [
      filamentLineCost,
      electricityFee,
      chainCost,
      pouchCost,
      cardCost,
      primerCost,
      clearcoatCost,
      shipping,
    ],
  );

  const fmt = (n: number) => fmtMoney(currencySymbol, n);

  const reset = () => {
    setKeychainDesign("");
    setPrintWeightG("");
    setFilamentCostPerG("");
    setElectricityFee("");
    setChainCost("");
    setPouchCost("");
    setCardCost("");
    setPrimerCost("");
    setClearcoatCost("");
    setShipping("");
  };

  const handleAddDesign = async () => {
    const name = keychainDesign.trim();
    if (!name) {
      toast.error("Enter a keychain design name before saving.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/cost-designs", {
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
          shipping: parseN(shipping),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not save design.");
        return;
      }
      toast.success("Design saved.");
      setSaveBump((k) => k + 1);
      onCostDesignMutated?.();
    } catch {
      toast.error("Could not save design.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <section className="card">
        <h2>Cost Price Calculator</h2>
        <p className="calc-lead muted">
          Keychain design costing. Total cost = (print weight × filament cost per g) + electricity + chain + pouch +
          card + primer + clearcoat + shipping.
        </p>

        <div style={{ marginTop: 14 }}>
          <label htmlFor="cpc-design">Keychain design</label>
          <input
            id="cpc-design"
            type="text"
            placeholder="Name or notes for this design"
            value={keychainDesign}
            onChange={(e) => setKeychainDesign(e.target.value)}
            autoComplete="off"
          />
        </div>

        <h3 className="calc-section-title">Print &amp; material</h3>
        <div className="row3">
          <div>
            <label htmlFor="cpc-weight">Print weight (g)</label>
            <input
              id="cpc-weight"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="0"
              value={printWeightG}
              onChange={(e) => setPrintWeightG(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cpc-filament">Filament cost per (g)</label>
            <input
              id="cpc-filament"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder={`${currencySymbol} per gram`}
              value={filamentCostPerG}
              onChange={(e) => setFilamentCostPerG(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cpc-electricity">Electricity fee</label>
            <input
              id="cpc-electricity"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="0"
              value={electricityFee}
              onChange={(e) => setElectricityFee(e.target.value)}
            />
          </div>
        </div>
        <p className="muted calc-filament-line">
          Filament line: {fmt(filamentLineCost)} <span className="calc-dim">(weight × cost per g)</span>
        </p>

        <h3 className="calc-section-title">Packaging &amp; finish</h3>
        <div className="row3">
          <div>
            <label htmlFor="cpc-chain">Chain cost</label>
            <input
              id="cpc-chain"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={chainCost}
              onChange={(e) => setChainCost(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cpc-pouch">Pouch cost</label>
            <input
              id="cpc-pouch"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={pouchCost}
              onChange={(e) => setPouchCost(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cpc-card">Card cost</label>
            <input
              id="cpc-card"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={cardCost}
              onChange={(e) => setCardCost(e.target.value)}
            />
          </div>
        </div>
        <div className="row3" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="cpc-primer">Primer cost</label>
            <input
              id="cpc-primer"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={primerCost}
              onChange={(e) => setPrimerCost(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cpc-clearcoat">Clearcoat cost</label>
            <input
              id="cpc-clearcoat"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={clearcoatCost}
              onChange={(e) => setClearcoatCost(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cpc-shipping">Shipping</label>
            <input
              id="cpc-shipping"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
            />
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
          <button type="button" onClick={handleAddDesign} disabled={saving}>
            {saving ? "Saving…" : "Add design"}
          </button>
          <button type="button" onClick={reset} disabled={saving}>
            Clear form
          </button>
        </div>
      </section>

      <SavedCostDesignsTable
        currencySymbol={currencySymbol}
        currentUser={currentUser}
        refreshSignal={refreshSignal}
        saveBump={saveBump}
        onCostDesignMutated={onCostDesignMutated}
      />
    </>
  );
}
