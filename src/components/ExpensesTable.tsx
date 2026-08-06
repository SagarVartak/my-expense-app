"use client";

import type { Expense } from "@/lib/types";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import InlineSpinner from "@/components/InlineSpinner";
import { fmtCurrency } from "@/lib/currencyFormat";

type Props = {
  expenses: Expense[];
  currencySymbol: string;
  canDelete: boolean;
  onDelete: (id: string) => void;
  deletingId?: string | null;
};

export default function ExpensesTable({ expenses, currencySymbol, canDelete, onDelete, deletingId }: Props) {
  const columns = [
    {
      accessorKey: "entry_uid",
      header: "Entry ID",
      cell: (info: any) => (
        <span className="font-mono text-xs">{info.getValue() || "—"}</span>
      ),
    },
    {
      accessorKey: "expense_date",
      header: "Date",
      cell: (info: any) => String(info.getValue()),
    },
    {
      accessorKey: "category",
      header: "Category",
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: (info: any) => {
        const expense = info.row.original;
        return (
          <div>
            {String(info.getValue())}
            <div className="text-muted-foreground text-xs">
              Method: {expense.payment_method}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "paid_by",
      header: "Paid By",
    },
    {
      accessorKey: "amount",
      header: "Amount",
      cell: (info: any) => (
        <span className="font-mono">
          {fmtCurrency(currencySymbol, Number(info.getValue()))}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Action",
      cell: (info: any) => {
        const expense = info.row.original;
        return (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(expense.id)}
            disabled={deletingId === expense.id}
            aria-busy={deletingId === expense.id}
          >
            {deletingId === expense.id ? (
              <>
                <InlineSpinner /> Deleting…
              </>
            ) : (
              "Delete"
            )}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="card">
      <h2>Expense Entries</h2>
      <DataTable
        columns={columns}
        data={expenses}
        searchKey="global"
        filterableColumns={["entry_uid", "category", "paid_by"]}
        sortable
        selectable={false}
        pagination
        pageSize={10}
        className="w-full"
      />
      {expenses.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">No entries yet.</div>
      )}
    </div>
  );
}