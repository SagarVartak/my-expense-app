"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import EditCostDesignModal from "@/components/EditCostDesignModal";
import { fmtCurrency } from "@/lib/currencyFormat";
import type { CostDesign, SessionUser } from "@/lib/types";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CellContext } from "@tanstack/react-table";

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
  refreshSignal: number;
  approvalSyncSignal?: number;
  saveBump?: number;
  onCostDesignMutated?: () => void;
  onChangeRequestSubmitted?: () => void;
  emptyHint?: string;
};

export default function SavedCostDesignsTable({
  currencySymbol,
  currentUser,
  refreshSignal,
  approvalSyncSignal = 0,
  saveBump = 0,
  onCostDesignMutated,
  onChangeRequestSubmitted,
  emptyHint = 'No designs yet. Fill the form on Cost Price Calculator and click "Add design".',
}: Props) {
  const [designs, setDesigns] = useState<CostDesign[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const hasLoadedOnce = useRef(false);
  const [editing, setEditing] = useState<CostDesign | null>(null);
  const [pendingDeletionIds, setPendingDeletionIds] = useState<Set<string>>(new Set());

  const loadPendingDeletions = useCallback(async () => {
    try {
      const res = await fetch("/api/deletion-requests?scope=mine", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) return;
      const next = new Set<string>();
      for (const r of (data.requests || []) as { resource_type: string; resource_id: string }[]) {
        if (r.resource_type === "cost_design") next.add(r.resource_id);
      }
      setPendingDeletionIds(next);
    } catch {
      /* ignore */
    }
  }, []);

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

  useEffect(() => {
    void loadPendingDeletions();
  }, [refreshSignal, saveBump, approvalSyncSignal, loadPendingDeletions]);

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

  const handleRequestDelete = async (id: string) => {
    if (!window.confirm("Request deletion? An admin must approve before this design is removed.")) return;
    try {
      const res = await fetch("/api/deletion-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_type: "cost_design", resource_id: id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not submit request.");
        return;
      }
      toast.success("Deletion request sent. An admin can approve it under Approvals → Deletions.");
      await loadPendingDeletions();
      onChangeRequestSubmitted?.();
    } catch {
      toast.error("Could not submit request.");
    }
  };

  const canDeleteRow = (createdBy: string) =>
    currentUser.role === "admin" || createdBy === currentUser.username;

  const columns = [
    {
      accessorKey: "keychain_design",
      header: "Keychain Design",
      cell: (info: any) => (
        <span className="design-name-cell" title={info.getValue()}>
          {info.getValue()}
        </span>
      ),
    },
    {
      accessorKey: "print_weight_g",
      header: "Print Weight (g)",
      cell: (info: any) => Number(info.getValue()).toFixed(2),
    },
    {
      accessorKey: "filament_cost_per_g",
      header: "Filament Cost/g",
      cell: (info: any) => fmtCurrency(currencySymbol, Number(info.getValue())),
    },
    {
      accessorKey: "electricity_fee",
      header: "Electricity",
      cell: (info: any) => fmtCurrency(currencySymbol, Number(info.getValue())),
    },
    {
      accessorKey: "chain_cost",
      header: "Chain",
      cell: (info: any) => fmtCurrency(currencySymbol, Number(info.getValue())),
    },
    {
      accessorKey: "pouch_cost",
      header: "Pouch",
      cell: (info: any) => fmtCurrency(currencySymbol, Number(info.getValue())),
    },
    {
      accessorKey: "card_cost",
      header: "Card",
      cell: (info: any) => fmtCurrency(currencySymbol, Number(info.getValue())),
    },
    {
      accessorKey: "primer_cost",
      header: "Primer",
      cell: (info: any) => fmtCurrency(currencySymbol, Number(info.getValue())),
    },
    {
      accessorKey: "clearcoat_cost",
      header: "Clearcoat",
      cell: (info: any) => fmtCurrency(currencySymbol, Number(info.getValue())),
    },
    {
      accessorKey: "key_caps_cost",
      header: "Key Caps",
      cell: (info: any) => fmtCurrency(currencySymbol, Number(info.getValue() ?? 0)),
    },
    {
      accessorKey: "colour_cost",
      header: "Colour",
      cell: (info: any) => fmtCurrency(currencySymbol, Number(info.getValue() ?? 0)),
    },
    {
      accessorKey: "shipping",
      header: "Shipping",
      cell: (info: any) => fmtCurrency(currencySymbol, Number(info.getValue())),
    },
    {
      accessorKey: "total_cost_price",
      header: "Total Cost",
      cell: (info: any) => fmtCurrency(currencySymbol, Number(info.getValue())),
    },
    {
      accessorKey: "created_by",
      header: "Saved By",
      cell: (info: any) => String(info.getValue()),
    },
    {
      accessorKey: "created_at",
      header: "Saved At",
      cell: (info: any) => fmtShortDate(String(info.getValue())),
    },
    {
      id: "actions",
      header: "Action",
      cell: (info: any) => {
        const design = info.row.original;
        const canDelete = canDeleteRow(design.created_by);
        const isAdmin = currentUser.role === "admin";

        return (
          <div className="design-table-actions">
            <Button variant="outline" size="sm" onClick={() => setEditing(design)}>
              Edit
            </Button>
            {canDelete ? (
              isAdmin ? (
                <Button variant="destructive" size="sm" onClick={() => handleDelete(design.id)}>
                  Delete
                </Button>
              ) : pendingDeletionIds.has(design.id) ? (
                <span className="text-xs text-muted-foreground">Delete pending</span>
              ) : (
                <Button variant="destructive" size="sm" onClick={() => handleRequestDelete(design.id)}>
                  Request Delete
                </Button>
              )
            ) : null}
          </div>
        );
      },
    },
  ];

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

      <DataTable
        columns={columns}
        data={designs}
        searchKey="global"
        filterableColumns={["keychain_design", "created_by"]}
        sortable
        selectable={false}
        pagination
        pageSize={10}
        className="w-full"
        onRowClick={(design) => {
          setEditing(design);
        }}
      />

      {loadingList && !hasLoadedOnce.current && (
        <div className="text-center py-8 text-muted-foreground">Loading saved designs…</div>
      )}
      {designs.length === 0 && !loadingList && (
        <div className="text-center py-8 text-muted-foreground">{emptyHint}</div>
      )}
    </section>
  );
}