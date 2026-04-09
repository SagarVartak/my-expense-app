"use client";

import { useState } from "react";
import InlineSpinner from "@/components/InlineSpinner";

type SpentRow = { name: string; total: number };

type Props = {
  currencySymbol: string;
  /** All-time total expenses (same basis as investment KPIs). */
  totalExpensesAll: number | null;
  /** Sum of net_profit for all approved (confirmed) order ledger rows. */
  approvedOrdersNetProfit: number | null;
  spentBy: SpentRow[];
  onExportCsv: () => void | Promise<void>;
  onExportJson: () => void | Promise<void>;
  onImport: (file?: File) => void | Promise<void>;
};

export default function Summary({
  currencySymbol,
  totalExpensesAll,
  approvedOrdersNetProfit,
  spentBy,
  onExportCsv,
  onExportJson,
  onImport,
}: Props) {
  const [importBusy, setImportBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState<"csv" | "json" | null>(null);
  const remainingInvestment =
    approvedOrdersNetProfit !== null && totalExpensesAll !== null
      ? approvedOrdersNetProfit - totalExpensesAll
      : null;

  const fmt = (n: number) => `${currencySymbol}${n.toFixed(2)}`;
  const fmtMaybe = (n: number | null) => (n === null ? "—" : fmt(n));

  return (
    <div className="card">
      <h2>Summary</h2>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
        <strong style={{ color: "var(--text)" }}>Net profit</strong> is the sum of net profit on <strong style={{ color: "var(--text)" }}>approved</strong>{" "}
        orders. <strong style={{ color: "var(--text)" }}>Total expenses</strong> is all-time spend in the expenses table.{" "}
        <strong style={{ color: "var(--text)" }}>Remaining investment</strong> is net profit minus those expenses. The breakdown table below uses your
        current expense filters.
      </p>

      <div className="pill" style={{ width: "100%", justifyContent: "space-between" }}>
        <span>Net profit (approved orders)</span>
        <span>{fmtMaybe(approvedOrdersNetProfit)}</span>
      </div>
      <div className="pill" style={{ width: "100%", justifyContent: "space-between", marginTop: 8 }}>
        <span>Total expenses (all-time)</span>
        <span>{fmtMaybe(totalExpensesAll)}</span>
      </div>
      <div
        className="pill"
        style={{
          width: "100%",
          justifyContent: "space-between",
          marginTop: 8,
          borderColor: remainingInvestment !== null && remainingInvestment < 0 ? "rgba(255, 120, 140, 0.45)" : undefined,
        }}
      >
        <span>Remaining investment</span>
        <span>{fmtMaybe(remainingInvestment)}</span>
      </div>

      <div className="hr" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="muted">Spent by (who paid)</div>
        <div className="pill">
          <span className="muted">Count:</span> <strong>{spentBy.length}</strong>
        </div>
      </div>
      <table style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>Paid By</th>
            <th className="amt">Total</th>
          </tr>
        </thead>
        <tbody>
          {spentBy.length === 0 ? (
            <tr>
              <td colSpan={2} className="muted">
                No expenses yet.
              </td>
            </tr>
          ) : (
            spentBy.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td className="amt">
                  {currencySymbol}
                  {row.total.toFixed(2)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="hr" />
      <h2 style={{ marginTop: 0 }}>Import / Export</h2>
      <div className="btnbar">
        <button
          type="button"
          disabled={exportBusy !== null || importBusy}
          aria-busy={exportBusy === "csv"}
          onClick={() => {
            setExportBusy("csv");
            void Promise.resolve(onExportCsv()).finally(() => setExportBusy(null));
          }}
        >
          {exportBusy === "csv" ? (
            <>
              <InlineSpinner /> Exporting…
            </>
          ) : (
            "Export CSV"
          )}
        </button>
        <button
          type="button"
          disabled={exportBusy !== null || importBusy}
          aria-busy={exportBusy === "json"}
          onClick={() => {
            setExportBusy("json");
            void Promise.resolve(onExportJson()).finally(() => setExportBusy(null));
          }}
        >
          {exportBusy === "json" ? (
            <>
              <InlineSpinner /> Exporting…
            </>
          ) : (
            "Export JSON"
          )}
        </button>
        <div className="import-inline" style={{ margin: 0 }}>
          <button type="button" disabled={importBusy || exportBusy !== null} aria-busy={importBusy}>
            {importBusy ? (
              <>
                <InlineSpinner /> Importing…
              </>
            ) : (
              "Import JSON/CSV"
            )}
          </button>
          <input
            type="file"
            accept=".json,.csv,application/json,text/csv"
            disabled={importBusy || exportBusy !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setImportBusy(true);
              void Promise.resolve(onImport(f)).finally(() => setImportBusy(false));
            }}
          />
        </div>
      </div>
    </div>
  );
}
