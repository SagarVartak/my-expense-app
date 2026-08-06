"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import InlineSpinner from "@/components/InlineSpinner";
import { fmtOrderMoney } from "@/lib/orderLedgerDisplay";
import type { CostDesign, OrderLedgerItem } from "@/lib/types";

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

type OrderItemForm = {
  costDesignId: string;
  quantity: number;
  unitSellingPrice: number;
};

export default function OrderLedger({ currencySymbol, onOrderMutated }: Props) {
  const [designs, setDesigns] = useState<CostDesign[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(true);
  const [saving, setSaving] = useState(false);

  const [orderDate, setOrderDate] = useState(todayISO());
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shipmentTracking, setShipmentTracking] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [actualWeightG, setActualWeightG] = useState("");
  const [items, setItems] = useState<OrderItemForm[]>([]);
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

  const itemRows = useMemo(() => {
    return items.map((item, index) => {
      const design = designs.find((d) => d.id === item.costDesignId);
      const designTotalCost = design ? Number(design.total_cost_price) : 0;
      const designShipping = design ? Number(design.shipping) : 0;
      const unitCostPrice = excludeShippingFromCost ? Math.max(0, designTotalCost - designShipping) : designTotalCost;
      const lineTotalCost = unitCostPrice * item.quantity;
      const lineTotalSelling = item.unitSellingPrice * item.quantity;
      const lineNetProfit = lineTotalSelling - lineTotalCost;
      return { design, unitCostPrice, lineTotalCost, lineTotalSelling, lineNetProfit };
    });
  }, [items, designs, excludeShippingFromCost]);

  const grandTotalCost = useMemo(() => itemRows.reduce((sum, r) => sum + r.lineTotalCost, 0), [itemRows]);
  const grandTotalSelling = useMemo(() => itemRows.reduce((sum, r) => sum + r.lineTotalSelling, 0), [itemRows]);
  const grandNetProfit = grandTotalSelling - grandTotalCost;

  const resetForm = () => {
    setOrderDate(todayISO());
    setCustomerName("");
    setCustomerPhone("");
    setShipmentTracking("");
    setShippingAddress("");
    setActualWeightG("");
    setItems([]);
    setPaymentMethod(PAYMENT_METHODS[0]);
    setPaymentStatus(PAYMENT_STATUS[0]);
    setDeliveryStatus(DELIVERY_STATUS[0]);
    setSource("");
    setFeedback("");
    setCustomerBehaviour("");
    setExcludeShippingFromCost(false);
  };

  const addItem = () => {
    setItems((prev) => [...prev, { costDesignId: "", quantity: 1, unitSellingPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItemForm, value: string | number) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleAddOrder = async () => {
    if (items.length === 0) {
      toast.error("Add at least one keychain design to the order.");
      return;
    }
    if (items.some((item) => !item.costDesignId)) {
      toast.error("Select a design for all items.");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Enter customer name.");
      return;
    }
    setSaving(true);
    try {
      const orderItems = items.map((item) => {
        const design = designs.find((d) => d.id === item.costDesignId)!;
        const designTotalCost = Number(design.total_cost_price);
        const designShipping = Number(design.shipping);
        const unitCostPrice = excludeShippingFromCost ? Math.max(0, designTotalCost - designShipping) : designTotalCost;
        return {
          cost_design_id: item.costDesignId,
          quantity: item.quantity,
          unit_cost_price: unitCostPrice,
          unit_selling_price: item.unitSellingPrice,
        };
      });

      const res = await fetch("/api/order-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_date: orderDate,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          shipment_tracking: shipmentTracking.trim(),
          shipping_address: shippingAddress.trim(),
          actual_weight_g: actualWeightG,
          items: orderItems,
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
        Add multiple keychain designs to a single order. Each item uses the saved design's total cost (optionally without
        the design's shipping line for friends / hand delivery). Net profit = total selling price − total cost used for this
        order. When an admin approves the order, the quantities are deducted from printed inventory for each design.
      </p>

      <div className="row3" style={{ marginTop: 12 }}>
        <div>
          <label htmlFor="ol-date">Date</label>
          <input id="ol-date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
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
        <div>
          <label htmlFor="ol-phone">Customer phone</label>
          <input
            id="ol-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="row3" style={{ marginTop: 10 }}>
        <div>
          <label htmlFor="ol-tracking">Shipment tracking #</label>
          <input
            id="ol-tracking"
            type="text"
            value={shipmentTracking}
            onChange={(e) => setShipmentTracking(e.target.value)}
            placeholder="Carrier / tracking ID"
          />
        </div>
        <div aria-hidden />
        <div aria-hidden />
      </div>

      <div style={{ marginTop: 10 }}>
        <label htmlFor="ol-address">Shipping address</label>
        <textarea id="ol-address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} rows={3} />
      </div>

      <div style={{ marginTop: 10 }}>
        <label htmlFor="ol-weight">Actual weight (g) — total for all items</label>
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

      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Order Items</h3>
          <button type="button" onClick={addItem} disabled={saving || loadingDesigns}>
            + Add Item
          </button>
        </div>
        {loadingDesigns ? (
          <div className="muted" style={{ padding: 12, textAlign: "center" }}>Loading designs…</div>
        ) : designs.length === 0 ? (
          <div className="muted" style={{ padding: 12, textAlign: "center" }}>
            No saved designs yet — add one under Cost Price Calculator first.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="order-table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ width: 200 }}>Keychain Design</th>
                  <th className="amt" style={{ width: 100 }}>Qty</th>
                  <th className="amt" style={{ width: 140 }}>Unit Cost</th>
                  <th className="amt" style={{ width: 140 }}>Unit Selling</th>
                  <th className="amt" style={{ width: 140 }}>Line Total Cost</th>
                  <th className="amt" style={{ width: 140 }}>Line Total Selling</th>
                  <th className="amt" style={{ width: 140 }}>Line Net Profit</th>
                  <th className="design-th-action" style={{ width: 60 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const design = designs.find((d) => d.id === item.costDesignId);
                  const designTotalCost = design ? Number(design.total_cost_price) : 0;
                  const designShipping = design ? Number(design.shipping) : 0;
                  const unitCostPrice = excludeShippingFromCost ? Math.max(0, designTotalCost - designShipping) : designTotalCost;
                  const lineTotalCost = unitCostPrice * item.quantity;
                  const lineTotalSelling = item.unitSellingPrice * item.quantity;
                  const lineNetProfit = lineTotalSelling - lineTotalCost;
                  return (
                    <tr key={index}>
                      <td>
                        <select
                          value={item.costDesignId}
                          onChange={(e) => updateItem(index, "costDesignId", e.target.value)}
                          disabled={loadingDesigns}
                          style={{ width: "100%", minWidth: 180 }}
                        >
                          <option value="">Select a design</option>
                          {designs.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.keychain_design}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="amt">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                          style={{ width: "100%" }}
                        />
                      </td>
                      <td className="amt">{design ? fmtOrderMoney(currencySymbol, unitCostPrice) : "—"}</td>
                      <td className="amt">
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min="0"
                          value={item.unitSellingPrice}
                          onChange={(e) => updateItem(index, "unitSellingPrice", parseFloat(e.target.value) || 0)}
                          style={{ width: "100%" }}
                        />
                      </td>
                      <td className="amt">{fmtOrderMoney(currencySymbol, lineTotalCost)}</td>
                      <td className="amt">{fmtOrderMoney(currencySymbol, lineTotalSelling)}</td>
                      <td className={`amt${lineNetProfit >= 0 ? " design-net-pos" : " design-net-neg"}`}>
                        {fmtOrderMoney(currencySymbol, lineNetProfit)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="delete"
                          onClick={() => removeItem(index)}
                          disabled={items.length <= 1 || saving}
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="row3" style={{ marginTop: 12 }}>
        <label htmlFor="ol-exclude-ship" className="span-row3 order-ledger-ship-waive">
          <input
            id="ol-exclude-ship"
            type="checkbox"
            checked={excludeShippingFromCost}
            onChange={(e) => setExcludeShippingFromCost(e.target.checked)}
            disabled={items.length === 0 || loadingDesigns}
          />
          <span>
            Don't include shipping fee from saved designs in this order's cost (e.g. friends / you deliver — no
            shipping charged).
          </span>
        </label>
      </div>

      <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(7, 12, 24, 0.52)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Total Cost</div>
            <div style={{ fontWeight: 600, color: "var(--text)" }}>{fmtOrderMoney(currencySymbol, grandTotalCost)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Total Selling</div>
            <div style={{ fontWeight: 600, color: "var(--text)" }}>{fmtOrderMoney(currencySymbol, grandTotalSelling)}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Net Profit</div>
            <div
              style={{
                fontWeight: 600,
                color: grandNetProfit >= 0 ? "#7dffc4" : "#ff9eb0",
              }}
            >
              {fmtOrderMoney(currencySymbol, grandNetProfit)}
            </div>
          </div>
        </div>
        {items.length > 0 && excludeShippingFromCost && (
          <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Design shipping fees excluded from cost.
          </p>
        )}
      </div>

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
        <button type="button" onClick={() => void handleAddOrder()} disabled={saving || items.length === 0} aria-busy={saving}>
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