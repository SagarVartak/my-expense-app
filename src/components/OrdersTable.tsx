"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import EditOrderModal from "@/components/EditOrderModal";
import { fmtOrderDate } from "@/lib/orderLedgerDisplay";
import { fmtOrderMoney } from "@/lib/orderLedgerDisplay";
import type { OrderLedgerEntry, SessionUser, OrderLedgerItem } from "@/lib/types";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CellContext } from "@tanstack/react-table";

type Props = {
  currencySymbol: string;
  currentUser: { username: string; role: "admin" | "manager" | "member" };
  refreshSignal: number;
  approvalSyncSignal?: number;
  onOrderMutated?: () => void;
  emptyHint?: string;
};

export default function OrdersTable({
  currencySymbol,
  currentUser,
  refreshSignal,
  approvalSyncSignal = 0,
  onOrderMutated,
  emptyHint = 'No orders yet. Open Order Ledger and click "Add order".',
}: Props) {
  const [orders, setOrders] = useState<OrderLedgerEntry[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const hasOrdersLoaded = useRef(false);
  const [editing, setEditing] = useState<OrderLedgerEntry | null>(null);
  const [pendingDeletionIds, setPendingDeletionIds] = useState<Set<string>>(new Set());

  const getApprovalBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline" | "success" | "warning"> = {
      approved: "success",
      pending: "warning",
      rejected: "destructive",
    };
    return variants[status] || "default";
  };

  const canEditOrder = (status: string) => status === "approved";

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this order?")) return;
    try {
      const res = await fetch(`/api/order-ledger/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not delete.");
        return;
      }
      toast.success("Order removed.");
      setOrders((prev) => prev.filter((o) => o.id !== id));
      onOrderMutated?.();
    } catch {
      toast.error("Could not delete.");
    }
  };

  const handleRequestDelete = async (id: string) => {
    if (!window.confirm("Request deletion? An admin must approve before this order is removed.")) return;
    try {
      const res = await fetch("/api/deletion-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_type: "order_ledger", resource_id: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not submit request.");
        return;
      }
      toast.success("Deletion request sent. An admin can approve it under Approvals → Deletions.");
      await loadPendingDeletions();
      onOrderMutated?.();
    } catch {
      toast.error("Could not submit request.");
    }
  };

  const loadPendingDeletions = useCallback(async () => {
    try {
      const res = await fetch("/api/deletion-requests?scope=mine", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) return;
      const next = new Set<string>();
      for (const r of (data.requests || []) as { resource_type: string; resource_id: string }[]) {
        if (r.resource_type === "order_ledger") next.add(r.resource_id);
      }
      setPendingDeletionIds(next);
    } catch {
      /* ignore */
    }
  }, []);

  const loadOrders = useCallback(async (soft: boolean) => {
    if (!soft || !hasOrdersLoaded.current) setLoadingOrders(true);
    try {
      const res = await fetch("/api/order-ledger", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not load orders.");
        return;
      }
      setOrders((data.orders || []) as OrderLedgerEntry[]);
      hasOrdersLoaded.current = true;
    } catch {
      toast.error("Could not load orders.");
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders(hasOrdersLoaded.current);
  }, [refreshSignal, loadOrders]);

  useEffect(() => {
    void loadPendingDeletions();
  }, [refreshSignal, approvalSyncSignal, loadPendingDeletions]);

  const columns = [
    {
      accessorKey: "order_uid",
      header: "Order ID",
      cell: (info: any) => <span className="font-mono text-xs">{info.getValue()}</span>,
    },
    {
      accessorKey: "approval_status",
      header: "Approval",
      cell: (info: any) => {
        const status = info.getValue() || "approved";
        return (
          <Badge variant={getApprovalBadge(status)}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "order_date",
      header: "Date",
      cell: (info: any) => String(info.getValue()),
    },
    {
      id: "items",
      header: "Items",
      cell: (info: any) => {
        const items = (info.row.original.items || []) as { keychain_design?: string; quantity?: number; unit_selling_price?: number; id: string }[];
        if (items.length === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="space-y-1">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 text-xs">
                <span>{item.keychain_design || "—"}</span>
                <span className="text-muted-foreground">×{item.quantity}</span>
                {item.unit_selling_price != null && (
                  <span className="text-muted-foreground">@ {fmtOrderMoney("₹", item.unit_selling_price)}</span>
                )}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      id: "totalQty",
      header: "Total Qty",
      cell: (info: any) => {
        const items = (info.row.original.items || []) as { quantity?: number }[];
        return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      },
    },
    {
      accessorKey: "customer_name",
      header: "Customer",
    },
    {
      accessorKey: "customer_phone",
      header: "Phone",
      cell: (info: any) => String(info.getValue()) || "—",
    },
    {
      accessorKey: "shipment_tracking",
      header: "Tracking",
      cell: (info: any) => String(info.getValue()) || "—",
    },
    {
      accessorKey: "shipping_address",
      header: "Shipping Address",
      cell: (info: any) => String(info.getValue()) || "—",
    },
    {
      accessorKey: "actual_weight_g",
      header: "Weight (g)",
      cell: (info: any) => Number(info.getValue()).toFixed(2),
    },
    {
      accessorKey: "total_cost_price",
      header: "Total Cost",
      cell: (info: any) => fmtOrderMoney(currencySymbol, Number(info.getValue())),
    },
    {
      accessorKey: "exclude_shipping_from_cost",
      header: "Ship in Cost",
      cell: (info: any) =>
        Boolean(info.getValue()) ? <span className="text-muted-foreground">Waived</span> : <span>Yes</span>,
    },
    {
      accessorKey: "selling_price",
      header: "Total Selling",
      cell: (info: any) => fmtOrderMoney(currencySymbol, Number(info.getValue())),
    },
    {
      accessorKey: "net_profit",
      header: "Net Profit",
      cell: (info: any) => {
        const profit = Number(info.getValue());
        return (
          <span className={profit >= 0 ? "text-green-500" : "text-red-500"}>
            {fmtOrderMoney(currencySymbol, profit)}
          </span>
        );
      },
    },
    {
      accessorKey: "payment_method",
      header: "Payment Method",
    },
    {
      accessorKey: "payment_status",
      header: "Payment Status",
    },
    {
      accessorKey: "delivery_status",
      header: "Delivery Status",
    },
    {
      accessorKey: "source",
      header: "Source",
      cell: (info: any) => String(info.getValue()) || "—",
    },
    {
      accessorKey: "feedback",
      header: "Feedback",
      cell: (info: any) => String(info.getValue()) || "—",
    },
    {
      accessorKey: "customer_behaviour",
      header: "Customer Behaviour",
      cell: (info: any) => String(info.getValue()) || "—",
    },
    {
      id: "actions",
      header: "Actions",
      cell: (info: any) => {
        const order = info.row.original;
        const st = order.approval_status ?? "approved";
        const isOwner = order.created_by === currentUser.username;
        const canEdit = canEditOrder(st);

        return (
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setEditing(order)}>
                Edit
              </Button>
            )}
            {currentUser.role === "admin" ? (
              <Button variant="destructive" size="sm" onClick={() => handleDelete(order.id)}>
                Delete
              </Button>
            ) : isOwner ? (
              pendingDeletionIds.has(order.id) ? (
                <span className="text-xs text-muted-foreground">Delete pending</span>
              ) : (
                <Button variant="destructive" size="sm" onClick={() => handleRequestDelete(order.id)}>
                  Request Delete
                </Button>
              )
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <section className="card">
      <EditOrderModal
        open={editing !== null}
        order={editing}
        currencySymbol={currencySymbol}
        onClose={() => setEditing(null)}
        onRequestSubmitted={() => {
          onOrderMutated?.();
        }}
      />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Orders</h2>
          <p className="text-sm text-muted-foreground">
            {loadingOrders && !hasOrdersLoaded.current
              ? "Loading…"
              : `${orders.length} orders.`}
          </p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={orders}
        searchKey="global"
        filterableColumns={["order_uid", "customer_name", "customer_phone"]}
        sortable
        selectable={false}
        pagination
        pageSize={10}
        className="w-full"
        onRowClick={(row) => {
          if (canEditOrder(row.approval_status ?? "approved")) {
            setEditing(row);
          }
        }}
      />

      {loadingOrders && !hasOrdersLoaded.current && (
        <div className="text-center py-8 text-muted-foreground">Loading orders…</div>
      )}
      {orders.length === 0 && !loadingOrders && (
        <div className="text-center py-8 text-muted-foreground">No orders yet. Open Order Ledger and click "Add order".</div>
      )}
    </section>
  );
}