"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import InlineSpinner from "@/components/InlineSpinner";
import { fmtOrderMoney } from "@/lib/orderLedgerDisplay";
import type { CostDesign } from "@/lib/types";

type Props = {
  currencySymbol: string;
  onOrderMutated?: () => void;
};

const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "UPI", "Wallet", "Other"];
const PAYMENT_STATUS = ["Pending", "Paid", "Partial", "Refunded", "Failed"];
const DELIVERY_STATUS = ["Pending", "Processing", "Shipped", "In transit", "Delivered", "Cancelled", "Returned"];

function todayISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function OrderLedger({ currencySymbol, onOrderMutated }: Props) {
  const [designs, setDesigns] = useState<CostDesign[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(true);
  const [saving, setSaving] = useState(false);

  const [orderDate, setOrderDate] = useState(todayISO());
  const [costDesignId, setCostDesignId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [actualWeightG, setActualWeightG] = useState("");
  const [units, setUnits] = useState("1");
  const [sellingPrice, setSellingPrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [paymentStatus, setPaymentStatus] = useState(PAYMENT_STATUS[0]);
  const [deliveryStatus, setDeliveryStatus] = useState(DELIVERY_STATUS[0]);
  const [source, setSource] = useState("");
  const [feedback, setFeedback] = useState("");
  const [customerBehaviour, setCustomerBehaviour] = useState("");
  const [excludeShippingFromCost, setExcludeShippingFromCost] = useState(false);

  const selectedDesign = useMemo(
    () => designs.find((d) => d.id === costDesignId) ?? null,
    [designs, costDesignId],
  );

  const totalCostPrice = selectedDesign ? Number(selectedDesign.total_cost_price) : 0;
  const designShipping = selectedDesign ? Number(selectedDesign.shipping) : 0;
  const effectiveTotalCost = useMemo(() => {
    if (!selectedDesign) return 0;
    if (!excludeShippingFromCost) return totalCostPrice;
    return Math.max(0, totalCostPrice - designShipping);
  }, [selectedDesign, totalCostPrice, designShipping, excludeShippingFromCost]);

  const sellingNum = useMemo(() => {
    const x = parseFloat(sellingPrice.replace(/,/g, "").trim());
    return Number.isFinite(x) ? x : 0;
  }, [sellingPrice]);
  const netProfit = sellingNum - effectiveTotalCost;

  const loadDesigns = useCallback(async () => {
    setLoadingDesigns(true);
    try {
      const res = await fetch("/api/cost-designs", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not load saved designs.");
        return;
      }
      setDesigns((data.designs || []) as CostDesign[]);
    } catch {
      toast.error("Could not load saved designs.");
    } finally {
      setLoadingDesigns(false);
    }
  }, []);

  useEffect(() => {
    void loadDesigns();
  }, [loadDesigns]);

  const resetForm = () => {
    setOrderDate(todayISO());
    setCostDesignId("");
    setCustomerName("");
    setShippingAddress("");
    setActualWeightG("");
    setUnits("1");
    setSellingPrice("");
    setPaymentMethod(PAYMENT_METHODS[0]);
    setPaymentStatus(PAYMENT_STATUS[0]);
    setDeliveryStatus(DELIVERY_STATUS[0]);
    setSource("");
    setFeedback("");
    setCustomerBehaviour("");
    setExcludeShippingFromCost(false);
  };

  const handleAddOrder = async () => {
    if (!costDesignId) {
      toast.error("Select a design from saved designs.");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Enter customer name.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/order-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_date: orderDate,
          cost_design_id: costDesignId,
          customer_name: customerName.trim(),
          shipping_address: shippingAddress.trim(),
          actual_weight_g: actualWeightG,
          units: Math.max(1, Math.floor(Number(units) || 1)),
          selling_price: sellingNum,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          delivery_status: deliveryStatus,
          source: source.trim(),
          feedback: feedback.trim(),
          customer_behaviour: customerBehaviour.trim(),
          exclude_shipping_from_cost: excludeShippingFromCost,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not save order.");
        return;
      }
      toast.success(
        `Order ${data.order?.order_uid ?? "saved"} submitted — pending admin approval. It will appear for everyone after approval.`,
      );
      onOrderMutated?.();
      resetForm();
    } catch {
      toast.error("Could not save order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <h2>Order Ledger</h2>
      <p className="calc-lead muted">
        Add a new order here. View all orders under <strong style={{ color: "var(--text)" }}>Orders</strong> in the
        sidebar.
      </p>
      <p className="calc-lead muted" style={{ marginTop: 8 }}>
        Link each order to a saved design; total cost comes from that design (optionally without the design’s
        shipping line for friends / hand delivery). Net profit = selling price − cost used for this order. When an
        admin approves the order, that many units are deducted from printed inventory for that design.
      </p>

      <div className="row3" style={{ marginTop: 12 }}>
        <div>
          <label htmlFor="ol-date">Date</label>
          <input id="ol-date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ol-design">Design (saved designs)</label>
          <select
            id="ol-design"
            value={costDesignId}
            onChange={(e) => setCostDesignId(e.target.value)}
            disabled={loadingDesigns}
          >
            <option value="">{loadingDesigns ? "Loading designs…" : "Select a design"}</option>
            {designs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.keychain_design}
              </option>
            ))}
          </select>
          {designs.length === 0 && !loadingDesigns ? (
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              No saved designs yet — add one under Cost Price Calculator first.
            </div>
          ) : null}
        </div>
        <div>
          <label htmlFor="ol-customer">Customer name</label>
          <input
            id="ol-customer"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            autoComplete="name"
          />
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <label htmlFor="ol-address">Shipping address</label>
        <textarea id="ol-address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} rows={3} />
      </div>

      <div className="row3" style={{ marginTop: 10 }}>
        <div>
          <label htmlFor="ol-weight">Actual weight (g)</label>
          <input
            id="ol-weight"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={actualWeightG}
            onChange={(e) => setActualWeightG(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="ol-units">Units (inventory)</label>
          <input
            id="ol-units"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            title="Number of items; deducted from printed stock when the order is approved"
          />
        </div>
        <div>
          <label htmlFor="ol-selling">Selling price</label>
          <input
            id="ol-selling"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={sellingPrice}
            onChange={(e) => setSellingPrice(e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <label>Total cost for this order</label>
        <div
          className="muted"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(7, 12, 24, 0.52)",
            fontWeight: 600,
            color: "var(--text)",
            maxWidth: 320,
          }}
        >
          {costDesignId ? fmtOrderMoney(currencySymbol, effectiveTotalCost) : "—"}
        </div>
        {costDesignId && excludeShippingFromCost && designShipping > 0 ? (
          <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
            Design shipping ({fmtOrderMoney(currencySymbol, designShipping)}) not included in cost.
          </p>
        ) : null}
      </div>

      <div className="row3" style={{ marginTop: 12 }}>
        <label htmlFor="ol-exclude-ship" className="span-row3 order-ledger-ship-waive">
          <input
            id="ol-exclude-ship"
            type="checkbox"
            checked={excludeShippingFromCost}
            onChange={(e) => setExcludeShippingFromCost(e.target.checked)}
            disabled={!costDesignId}
          />
          <span>
            Don’t include shipping fee from saved design in this order’s cost (e.g. friends / you deliver — no
            shipping charged).
          </span>
        </label>
      </div>

      <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
        Net profit:{" "}
        <strong style={{ color: netProfit >= 0 ? "#7dffc4" : "#ff9eb0" }}>
          {fmtOrderMoney(currencySymbol, netProfit)}
        </strong>
      </p>

      <div className="row3" style={{ marginTop: 10 }}>
        <div>
          <label htmlFor="ol-pay">Payment method</label>
          <select id="ol-pay" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ol-pay-st">Payment status</label>
          <select id="ol-pay-st" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
            {PAYMENT_STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ol-del">Delivery status</label>
          <select id="ol-del" value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value)}>
            {DELIVERY_STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <label htmlFor="ol-source">Source</label>
        <input id="ol-source" type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Instagram, website" />
      </div>
      <div style={{ marginTop: 10 }}>
        <label htmlFor="ol-feedback">Feedback</label>
        <textarea id="ol-feedback" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} />
      </div>
      <div style={{ marginTop: 10 }}>
        <label htmlFor="ol-behaviour">Customer behaviour</label>
        <textarea id="ol-behaviour" value={customerBehaviour} onChange={(e) => setCustomerBehaviour(e.target.value)} rows={2} />
      </div>

      <div className="btnbar" style={{ marginTop: 14 }}>
        <button type="button" onClick={() => void handleAddOrder()} disabled={saving} aria-busy={saving}>
          {saving ? (
            <>
              <InlineSpinner /> Saving…
            </>
          ) : (
            "Add order"
          )}
        </button>
        <button type="button" onClick={resetForm} disabled={saving}>
          Clear form
        </button>
      </div>
    </section>
  );
}
