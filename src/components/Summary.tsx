"use client";

type SpentRow = { name: string; total: number };

type Props = {
  currencySymbol: string;
  totalSpent: number;
  spentBy: SpentRow[];
  onExportCsv: () => void;
  onExportJson: () => void;
  onImport: (file?: File) => void;
};

export default function Summary({
  currencySymbol,
  totalSpent,
  spentBy,
  onExportCsv,
  onExportJson,
  onImport,
}: Props) {
  return (
    <aside className="card">
      <h2>Summary</h2>
      <div className="pill" style={{ width: "100%", justifyContent: "space-between" }}>
        <span>Total spent till now</span>
        <span>
          {currencySymbol}
          {totalSpent.toFixed(2)}
        </span>
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
        <button type="button" onClick={onExportCsv}>
          Export CSV
        </button>
        <button type="button" onClick={onExportJson}>
          Export JSON
        </button>
        <div className="import-inline" style={{ margin: 0 }}>
          <button type="button">Import JSON/CSV</button>
          <input
            type="file"
            accept=".json,.csv,application/json,text/csv"
            onChange={(e) => onImport(e.target.files?.[0])}
          />
        </div>
      </div>
    </aside>
  );
}

