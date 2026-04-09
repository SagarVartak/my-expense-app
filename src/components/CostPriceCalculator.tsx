"use client";

import { useMemo, useState } from "react";
import { toast } from "react-toastify";
import DecimalCostInput from "@/components/DecimalCostInput";
import InlineSpinner from "@/components/InlineSpinner";
import { fmtCurrency } from "@/lib/currencyFormat";
import SavedCostDesignsTable from "@/components/SavedCostDesignsTable";
import type { SessionUser } from "@/lib/types";

type Props = {
  currencySymbol: string;
  currentUser: SessionUser;
  refreshSignal: number;
  /** Bumps when approvals / deletion queue changes (reload pending-delete badges). */
  approvalSyncSignal?: number;
  /** Called after a design is saved (e.g. refresh admin audit log). */
  onCostDesignMutated?: () => void;
  /** After an edit is submitted for approval (pending admin). */
  onChangeRequestSubmitted?: () => void;
};

function parseN(s: string): number {
  const x = parseFloat(String(s).replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

export default function CostPriceCalculator({
  currencySymbol,
  currentUser,
  refreshSignal,
  approvalSyncSignal = 0,
  onCostDesignMutated,
  onChangeRequestSubmitted,
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
  const [keyCapsCost, setKeyCapsCost] = useState("");
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
      parseN(keyCapsCost) +
      parseN(shipping),
    [
      filamentLineCost,
      electricityFee,
      chainCost,
      pouchCost,
      cardCost,
      primerCost,
      clearcoatCost,
      keyCapsCost,
      shipping,
    ],
  );

  const fmt = (n: number) => fmtCurrency(currencySymbol, n);

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
    setKeyCapsCost("");
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
          key_caps_cost: parseN(keyCapsCost),
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
          card + primer + clearcoat + key caps + shipping.
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
            <DecimalCostInput
              id="cpc-weight"
              placeholder="0"
              value={printWeightG}
              onValueChange={setPrintWeightG}
            />
          </div>
          <div>
            <label htmlFor="cpc-filament">Filament cost per (g)</label>
            <DecimalCostInput
              id="cpc-filament"
              placeholder={`${currencySymbol} per gram`}
              value={filamentCostPerG}
              onValueChange={setFilamentCostPerG}
            />
          </div>
          <div>
            <label htmlFor="cpc-electricity">Electricity fee</label>
            <DecimalCostInput
              id="cpc-electricity"
              placeholder="0"
              value={electricityFee}
              onValueChange={setElectricityFee}
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
            <DecimalCostInput id="cpc-chain" value={chainCost} onValueChange={setChainCost} />
          </div>
          <div>
            <label htmlFor="cpc-pouch">Pouch cost</label>
            <DecimalCostInput id="cpc-pouch" value={pouchCost} onValueChange={setPouchCost} />
          </div>
          <div>
            <label htmlFor="cpc-card">Card cost</label>
            <DecimalCostInput id="cpc-card" value={cardCost} onValueChange={setCardCost} />
          </div>
        </div>
        <div className="row3" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="cpc-primer">Primer cost</label>
            <DecimalCostInput id="cpc-primer" value={primerCost} onValueChange={setPrimerCost} />
          </div>
          <div>
            <label htmlFor="cpc-clearcoat">Clearcoat cost</label>
            <DecimalCostInput id="cpc-clearcoat" value={clearcoatCost} onValueChange={setClearcoatCost} />
          </div>
          <div>
            <label htmlFor="cpc-keycaps">Key caps</label>
            <DecimalCostInput id="cpc-keycaps" value={keyCapsCost} onValueChange={setKeyCapsCost} />
          </div>
        </div>
        <div className="row3" style={{ marginTop: 10 }}>
          <div className="span-row3">
            <label htmlFor="cpc-shipping">Shipping</label>
            <DecimalCostInput id="cpc-shipping" value={shipping} onValueChange={setShipping} />
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
          <button type="button" onClick={() => void handleAddDesign()} disabled={saving} aria-busy={saving}>
            {saving ? (
              <>
                <InlineSpinner /> Saving…
              </>
            ) : (
              "Add design"
            )}
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
        approvalSyncSignal={approvalSyncSignal}
        saveBump={saveBump}
        onCostDesignMutated={onCostDesignMutated}
        onChangeRequestSubmitted={onChangeRequestSubmitted}
      />
    </>
  );
}
