"use client";

import type { Expense } from "@/lib/types";

type Props = {
  expenses: Expense[];
  currencySymbol: string;
  onDelete: (id: string) => void;
};

export default function ExpensesTable({ expenses, currencySymbol, onDelete }: Props) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h2>Expense Entries</h2>
      <div style={{ overflow: "auto", borderRadius: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Paid By</th>
              <th className="amt">Amount</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No entries yet.
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id}>
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
                  <td>
                    <button className="delete" type="button" onClick={() => onDelete(e.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

