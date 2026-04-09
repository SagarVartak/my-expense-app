"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import InlineSpinner from "@/components/InlineSpinner";
import { fmtOrderMoney } from "@/lib/orderLedgerDisplay";
import type { CostDesign, OrderLedgerEntry } from "@/lib/types";

const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "UPI", "Wallet", "Other"];
const PAYMENT_STATUS = ["Pending", "Paid", "Partial", "Refunded", "Failed"];
const DELIVERY_STATUS = ["Pending", "Processing", "Shipped", "In transit", "Delivered", "Cancelled", "Returned"];

type Props = {
  open: boolean;
  order: OrderLedgerEntry | null;
  currencySymbol: string;
  onClose: () => void;
  onRequestSubmitted?: () => void;
};

function parseN(s: string): number {
  const x = parseFloat(String(s).replace(/,/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

export default function EditOrderModal({ open, order, currencySymbol, onClose, onRequestSubmitted }: Props) {
  const [designs, setDesigns] = useState<CostDesign[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(true);
  const [saving, setSaving] = useState(false);

  const [orderDate, setOrderDate] = useState("");
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

  const loadDesigns = useCallback(async () => {
    setLoadingDesigns(true);
    try {
      const res = await fetch("/api/cost-designs", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) return;
      setDesigns((data.designs || []) as CostDesign[]);
    } finally {
      setLoadingDesigns(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadDesigns();
  }, [open, loadDesigns]);

  useEffect(() => {
    if (!open || !order) return;
    setOrderDate(String(order.order_date ?? "").slice(0, 10));
    setCostDesignId(order.cost_design_id ?? "");
    setCustomerName(order.customer_name ?? "");
    setShippingAddress(order.shipping_address ?? "");
    setActualWeightG(String(order.actual_weight_g ?? ""));
    setUnits(String(order.units ?? 1));
    setSellingPrice(String(order.selling_price ?? ""));
    setPaymentMethod(order.payment_method || PAYMENT_METHODS[0]);
    setPaymentStatus(order.payment_status || PAYMENT_STATUS[0]);
    setDeliveryStatus(order.delivery_status || DELIVERY_STATUS[0]);
    setSource(order.source ?? "");
    setFeedback(order.feedback ?? "");
    setCustomerBehaviour(order.customer_behaviour ?? "");
    setExcludeShippingFromCost(order.exclude_shipping_from_cost === true);
  }, [open, order]);

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

  const sellingNum = useMemo(() => parseN(sellingPrice), [sellingPrice]);
  const netProfit = sellingNum - effectiveTotalCost;

  const handleSubmit = async () => {
    if (!order) return;
    if (!costDesignId) {
      toast.error("Select a design.");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Enter customer name.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/order-ledger/${order.id}/change-requests`, {
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
        toast.error(data.error || "Could not submit edit.");
        return;
      }
      toast.success("Edit submitted for admin approval.");
      onRequestSubmitted?.();
      onClose();
    } catch {
      toast.error("Could not submit edit.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !order) return null;
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
        aria-labelledby="edit-order-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="edit-order-title" style={{ margin: "0 0 6px", fontSize: 18 }}>
          Edit order {order.order_uid}
        </h2>
        <p className="muted" style={{ margin: "0 0 14px", fontSize: 13 }}>
          Changes apply after an admin approves under <strong style={{ color: "var(--text)" }}>Approvals → Orders</strong>.
        </p>

        <div className="row3" style={{ marginTop: 8 }}>
          <div>
            <label htmlFor="eom-date">Date</label>
            <input id="eom-date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="eom-design">Design</label>
            <select
              id="eom-design"
              value={costDesignId}
              onChange={(e) => setCostDesignId(e.target.value)}
              disabled={loadingDesigns}
            >
              <option value="">{loadingDesigns ? "Loading…" : "Select"}</option>
              {designs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.keychain_design}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="eom-customer">Customer name</label>
            <input id="eom-customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label htmlFor="eom-address">Shipping address</label>
          <textarea id="eom-address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} rows={2} />
        </div>

        <div className="row3" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="eom-weight">Actual weight (g)</label>
            <input
              id="eom-weight"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              value={actualWeightG}
              onChange={(e) => setActualWeightG(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="eom-units">Units (inventory)</label>
            <input
              id="eom-units"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
              title="Deducted from printed stock when this edit is approved"
            />
          </div>
          <div>
            <label htmlFor="eom-selling">Selling price</label>
            <input
              id="eom-selling"
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
          <label>Total cost for order</label>
          <div
            className="muted"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(7, 12, 24, 0.52)",
              fontWeight: 600,
              maxWidth: 320,
            }}
          >
            {costDesignId ? fmtOrderMoney(currencySymbol, effectiveTotalCost) : "—"}
          </div>
        </div>

        <div className="row3" style={{ marginTop: 12 }}>
          <label htmlFor="eom-exclude" className="span-row3 order-ledger-ship-waive">
            <input
              id="eom-exclude"
              type="checkbox"
              checked={excludeShippingFromCost}
              onChange={(e) => setExcludeShippingFromCost(e.target.checked)}
              disabled={!costDesignId}
            />
            <span>Exclude saved design shipping from this order’s cost.</span>
          </label>
        </div>

        <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          Net profit:{" "}
          <strong style={{ color: netProfit >= 0 ? "#7dffc4" : "#ff9eb0" }}>{fmtOrderMoney(currencySymbol, netProfit)}</strong>
        </p>

        <div className="row3" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="eom-pay">Payment method</label>
            <select id="eom-pay" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="eom-pst">Payment status</label>
            <select id="eom-pst" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
              {PAYMENT_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="eom-del">Delivery status</label>
            <select id="eom-del" value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value)}>
              {DELIVERY_STATUS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label htmlFor="eom-source">Source</label>
          <input id="eom-source" value={source} onChange={(e) => setSource(e.target.value)} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label htmlFor="eom-fb">Feedback</label>
          <textarea id="eom-fb" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} />
        </div>
        <div style={{ marginTop: 10 }}>
          <label htmlFor="eom-beh">Customer behaviour</label>
          <textarea id="eom-beh" value={customerBehaviour} onChange={(e) => setCustomerBehaviour(e.target.value)} rows={2} />
        </div>

        <div className="btnbar" style={{ marginTop: 16 }}>
          <button type="button" onClick={() => void handleSubmit()} disabled={saving} aria-busy={saving}>
            {saving ? (
              <>
                <InlineSpinner /> Submitting…
              </>
            ) : (
              "Submit for approval"
            )}
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
