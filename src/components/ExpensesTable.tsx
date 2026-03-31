"use client";

import type { Expense } from "@/lib/types";

type Props = {
  expenses: Expense[];
  currencySymbol: string;
  canDelete: boolean;
  onDelete: (id: string) => void;
};

export default function ExpensesTable({ expenses, currencySymbol, canDelete, onDelete }: Props) {
  const cols = canDelete ? 7 : 6;
  return (
    <div className="card">
      <h2>Expense Entries</h2>
      <div style={{ overflow: "auto", borderRadius: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Entry ID</th>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Paid By</th>
              <th className="amt">Amount</th>
              {canDelete ? <th>Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={cols} className="muted">
                  No entries yet.
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id}>
                  <td className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {e.entry_uid ?? "—"}
                  </td>
                  <td>{e.expense_date}</td>
                  <td>{e.category}</td>
                  <td>
                    {e.description}
                    <div className="muted" style={{ fontSize: 12 }}>
                      Method: {e.payment_method}
                    </div>
                  </td>
                  <td>{e.paid_by}</td>
                  <td className="amt">
                    {currencySymbol}
                    {Number(e.amount).toFixed(2)}
                  </td>
                  {canDelete ? (
                    <td>
                      <button className="delete" type="button" onClick={() => onDelete(e.id)}>
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

