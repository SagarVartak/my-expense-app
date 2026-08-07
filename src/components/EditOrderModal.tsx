"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import InlineSpinner from "@/components/InlineSpinner";
import { fmtOrderMoney } from "@/lib/orderLedgerDisplay";
import type { CostDesign, OrderLedgerEntry, OrderLedgerItem, DeadlineStatus } from "@/lib/types";

const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "UPI", "Wallet", "Other"];
const PAYMENT_STATUS = ["Pending", "Paid", "Partial", "Refunded", "Failed"];
const DELIVERY_STATUS = ["Pending", "Processing", "Shipped", "In transit", "Delivered", "Cancelled", "Returned"];
const DEADLINE_STATUSES: DeadlineStatus[] = ["not_started", "print_started", "print_done", "in_transit", "delivered", "cancelled"];

const DEADLINE_LABELS: Record<DeadlineStatus, string> = {
  not_started: "Not Started",
  print_started: "Print Started",
  print_done: "Print Done",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

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

type OrderItemForm = {
  costDesignId: string;
  quantity: number;
  unitSellingPrice: number;
};

export default function EditOrderModal({ open, order, currencySymbol, onClose, onRequestSubmitted }: Props) {
  const [designs, setDesigns] = useState<CostDesign[]>([]);
  const [loadingDesigns, setLoadingDesigns] = useState(true);
  const [saving, setSaving] = useState(false);

  const [orderDate, setOrderDate] = useState("");
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
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineStatus, setDeadlineStatus] = useState<DeadlineStatus>("not_started");

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
    setCustomerName(order.customer_name ?? "");
    setCustomerPhone(order.customer_phone ?? "");
    setShipmentTracking(order.shipment_tracking ?? "");
    setShippingAddress(order.shipping_address ?? "");
    setActualWeightG(String(order.actual_weight_g ?? ""));
    setPaymentMethod(order.payment_method || PAYMENT_METHODS[0]);
    setPaymentStatus(order.payment_status || PAYMENT_STATUS[0]);
    setDeliveryStatus(order.delivery_status || DELIVERY_STATUS[0]);
    setSource(order.source ?? "");
    setFeedback(order.feedback ?? "");
    setCustomerBehaviour(order.customer_behaviour ?? "");
    setExcludeShippingFromCost(order.exclude_shipping_from_cost === true);
    setDeadlineDate(order.deadline_date ? String(order.deadline_date).slice(0, 10) : "");
    setDeadlineStatus((order.deadline_status as DeadlineStatus) || "not_started");

    // Load items from order.items or fall back to legacy single-design fields
    if (order.items && order.items.length > 0) {
      setItems(
        order.items.map((item) => ({
          costDesignId: item.cost_design_id,
          quantity: item.quantity,
          unitSellingPrice: item.unit_selling_price,
        }))
      );
    } else {
      // Legacy: single design
      setItems([
        {
          costDesignId: order.cost_design_id ?? "",
          quantity: order.units ?? 1,
          unitSellingPrice: order.selling_price ?? 0,
        },
      ]);
    }
  }, [open, order]);

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

  const handleSubmit = async () => {
    if (!order) return;
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

      const res = await fetch(`/api/order-ledger/${order.id}/change-requests`, {
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
          deadline_date: deadlineDate || null,
          deadline_status: deadlineStatus,
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

  const addItem = () => {
    setItems((prev) => [...prev, { costDesignId: "", quantity: 1, unitSellingPrice: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof OrderItemForm, value: string | number) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

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
            <label htmlFor="eom-customer">Customer name</label>
            <input id="eom-customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="eom-phone">Customer phone</label>
            <input
              id="eom-phone"
              type="tel"
              inputMode="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="row3" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="eom-tracking">Shipment tracking #</label>
            <input
              id="eom-tracking"
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
          <label htmlFor="eom-address">Shipping address</label>
          <textarea id="eom-address" value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} rows={2} />
        </div>

        <div style={{ marginTop: 10 }}>
          <label htmlFor="eom-weight">Actual weight (g) — total for all items</label>
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
          <label htmlFor="eom-exclude" className="span-row3 order-ledger-ship-waive">
            <input
              id="eom-exclude"
              type="checkbox"
              checked={excludeShippingFromCost}
              onChange={(e) => setExcludeShippingFromCost(e.target.checked)}
              disabled={items.length === 0 || loadingDesigns}
            />
            <span>Exclude saved design shipping from this order&apos;s cost.</span>
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

        <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
          Net profit:{" "}
          <strong style={{ color: grandNetProfit >= 0 ? "#7dffc4" : "#ff9eb0" }}>
            {fmtOrderMoney(currencySymbol, grandNetProfit)}
          </strong>
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

        <div className="row3" style={{ marginTop: 10 }}>
          <div>
            <label htmlFor="eom-deadline">Deadline date</label>
            <input id="eom-deadline" type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="eom-deadline-st">Deadline status</label>
            <select id="eom-deadline-st" value={deadlineStatus} onChange={(e) => setDeadlineStatus(e.target.value as DeadlineStatus)}>
              {DEADLINE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {DEADLINE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div aria-hidden />
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