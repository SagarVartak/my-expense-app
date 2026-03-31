"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Login from "@/components/Login";
import Summary from "@/components/Summary";
import ExpensesTable from "@/components/ExpensesTable";
import AuditTable from "@/components/AuditTable";
import UserManagement from "@/components/UserManagement";
import type { AppUser, AuditLog, Expense, SessionUser } from "@/lib/types";

const CATEGORIES = [
  "Filament/Material",
  "Printer Maintenance",
  "Equipment/Tools",
  "Electricity/Internet",
  "Shipping",
  "Packaging",
  "Marketing/Ads",
  "Fuel/Travel",
  "Other",
];
const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "UPI", "Wallet", "Other"];

const todayISO = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
export default function Home() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);

  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [description, setDescription] = useState("");
  const [formHint, setFormHint] = useState("");
  const [formError, setFormError] = useState(false);
  const [filterPaidBy, setFilterPaidBy] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const currencySymbol = "₹";
  const businessName = "3D Printing Expense Sheet";

  useEffect(() => {
    const boot = async () => {
      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        if (meRes.ok) {
          const meData = await meRes.json();
          setCurrentUser(meData.user);
        }
      } finally {
        setLoaded(true);
      }
    };
    void boot();
  }, []);

  const writeAudit = async (action: string, details: string) => {
    await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, details }),
    });
  };

  const refreshExpenses = useCallback(async () => {
    const qs = new URLSearchParams();
    if (filterPaidBy) qs.set("paidBy", filterPaidBy);
    if (filterStartDate) qs.set("startDate", filterStartDate);
    if (filterEndDate) qs.set("endDate", filterEndDate);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const res = await fetch(`/api/expenses${suffix}`, { cache: "no-store" });
    const data = await res.json();
    setExpenses((data.expenses || []) as Expense[]);
  }, [filterEndDate, filterPaidBy, filterStartDate]);

  const refreshLogs = useCallback(async () => {
    if (currentUser?.role !== "admin") return;
    const res = await fetch("/api/audit", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setAuditLogs((data.logs || []) as AuditLog[]);
  }, [currentUser?.role]);

  const refreshUsers = useCallback(async () => {
    if (currentUser?.role !== "admin") return;
    const res = await fetch("/api/users", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setUsers((data.users || []) as AppUser[]);
  }, [currentUser?.role]);

  useEffect(() => {
    if (!currentUser) return;
    const run = async () => {
      await refreshExpenses();
      await refreshLogs();
      await refreshUsers();
    };
    void run();
  }, [currentUser, refreshExpenses, refreshLogs, refreshUsers]);

  useEffect(() => {
    if (!currentUser) return;
    void refreshExpenses();
  }, [currentUser, filterPaidBy, filterStartDate, filterEndDate, refreshExpenses]);

  const participants = useMemo(() => {
    const set = new Set(expenses.map((e) => e.paid_by).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [expenses]);

  const sortedExpenses = useMemo(() => [...expenses], [expenses]);
  const totalSpent = useMemo(
    () => expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0),
    [expenses],
  );
  const spentBy = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses) {
      map.set(e.paid_by || "Unknown", (map.get(e.paid_by || "Unknown") || 0) + Number(e.amount || 0));
    }
    return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [expenses]);

  const handleLogout = async () => {
    await writeAudit("LOGOUT", "User logged out");
    await fetch("/api/auth/logout", { method: "POST" });
    setCurrentUser(null);
    setExpenses([]);
    setAuditLogs([]);
  };

  const handleAddExpense = async () => {
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setFormHint("Enter a valid amount (> 0).");
      setFormError(true);
      return;
    }
    if (!paidBy.trim()) {
      setFormHint("Enter who paid this expense (Paid By).");
      setFormError(true);
      return;
    }

    const payload = {
      expense_date: date || todayISO(),
      category,
      amount: amountNum,
      paid_by: paidBy.trim(),
      payment_method: paymentMethod,
      description: description.trim(),
    };
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setFormHint("Failed to add expense.");
      setFormError(true);
      return;
    }

    await writeAudit("ADD_EXPENSE", `${payload.paid_by} spent ${currencySymbol}${money(payload.amount)} on ${payload.category}`);
    await refreshExpenses();
    if (currentUser?.role === "admin") await refreshLogs();

    setAmount("");
    setPaidBy("");
    setDescription("");
    setPaymentMethod(PAYMENT_METHODS[0]);
    setFormHint("Added.");
    setFormError(false);
  };

  const handleDeleteExpense = async (id: string) => {
    const target = expenses.find((e) => e.id === id);
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (!res.ok) return;

    if (target) {
      await writeAudit(
        "DELETE_EXPENSE",
        `${target.paid_by} ${currencySymbol}${money(Number(target.amount))} (${target.category})`,
      );
    }
    await refreshExpenses();
    if (currentUser?.role === "admin") await refreshLogs();
  };

  const handleResetAll = async () => {
    if (!window.confirm("Reset all expense data? This cannot be undone.")) return;
    const toDelete = [...expenses];
    for (const row of toDelete) {
      await fetch(`/api/expenses/${row.id}`, { method: "DELETE" });
    }
    await writeAudit("RESET_ALL", `Reset all data, removed ${toDelete.length} expenses`);
    await refreshExpenses();
    if (currentUser?.role === "admin") await refreshLogs();

    setDate(todayISO());
    setAmount("");
    setPaidBy("");
    setDescription("");
    setPaymentMethod(PAYMENT_METHODS[0]);
    setFormHint("");
    setFormError(false);
  };

  const csvEscape = (value: string | number) => {
    const s = String(value ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const downloadTextFile = (filename: string, text: string, type: string) => {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const handleExportCSV = async () => {
    const headers = ["date", "category", "description", "paidBy", "paymentMethod", "amount"];
    const rows = sortedExpenses.map((e) =>
      [e.expense_date, e.category, e.description, e.paid_by, e.payment_method, Number(e.amount)].map(csvEscape).join(","),
    );
    downloadTextFile("expenses.csv", [headers.join(","), ...rows].join("\n"), "text/csv");
    await writeAudit("EXPORT_CSV", `Exported ${expenses.length} expense rows`);
    if (currentUser?.role === "admin") await refreshLogs();
  };

  const handleExportJSON = async () => {
    downloadTextFile("expenses-backup.json", JSON.stringify(expenses, null, 2), "application/json");
    await writeAudit("EXPORT_JSON", "Exported expenses JSON");
    if (currentUser?.role === "admin") await refreshLogs();
  };

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const text = (await file.text()).trim();
      if (text.startsWith("{") || text.startsWith("[")) {
        const parsed = JSON.parse(text);
        const rows: Expense[] = Array.isArray(parsed) ? parsed : parsed?.expenses || [];
        for (const row of rows) {
          await fetch("/api/expenses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              expense_date: row.expense_date,
              category: row.category,
              amount: Number(row.amount || 0),
              paid_by: row.paid_by,
              payment_method: row.payment_method,
              description: row.description || "",
            }),
          });
        }
      } else {
        const importRes = await fetch("/api/expenses/import-csv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csvText: text }),
        });
        if (!importRes.ok) throw new Error("CSV import failed");
      }
      await writeAudit("IMPORT_FILE", `Imported file ${file.name}`);
      await refreshExpenses();
      if (currentUser?.role === "admin") await refreshLogs();
      setFormHint("Imported successfully.");
      setFormError(false);
    } catch {
      setFormHint("Import failed.");
      setFormError(true);
    }
  };

  const createUser = async (payload: { username: string; password: string; role: "admin" | "member" }) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return;
    await writeAudit("CREATE_USER", `Created user ${payload.username} (${payload.role})`);
    await refreshUsers();
    await refreshLogs();
  };

  const toggleUser = async (id: string, active: boolean) => {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (!res.ok) return;
    await writeAudit("TOGGLE_USER", `${active ? "Enabled" : "Disabled"} user id ${id}`);
    await refreshUsers();
    await refreshLogs();
  };

  if (!loaded) return null;
  if (!currentUser) return <Login onSuccess={setCurrentUser} />;

  return (
    <div className="wrap">
      <header>
        <div>
          <h1>{businessName}</h1>
          <div className="sub">Tracks expenses, calculates total spent till now, and shows totals by who paid.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="pill">
            <span className="muted">User:</span> <strong>{currentUser.username}</strong>
          </div>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
          <div className="pill">
            <span className="muted">Currency symbol:</span> <strong>{currencySymbol}</strong>
          </div>
        </div>
      </header>

      <div className="grid">
        <section className="card">
          <h2>Add Expense</h2>
          <div className="row3">
            <div>
              <label htmlFor="expDate">Date</label>
              <input id="expDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="category">Category</label>
              <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="amount">Amount</label>
              <input id="amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <div>
              <label htmlFor="paidBy">Paid By</label>
              <input id="paidBy" list="paidByList" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} />
              <datalist id="paidByList">
                {participants.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="paymentMethod">Payment Method</label>
              <select id="paymentMethod" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label htmlFor="description">Description (optional)</label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="btnbar">
            <button type="button" onClick={handleAddExpense}>
              Add Expense
            </button>
            <span className="muted" style={{ color: formError ? "#ffb0bf" : undefined }}>
              {formHint}
            </span>
          </div>
          <div className="footer-actions">
            <div className="muted">{expenses.length} expenses</div>
            <button className="btn-danger" type="button" onClick={handleResetAll}>
              Reset All Data
            </button>
          </div>
        </section>

        <Summary
          currencySymbol={currencySymbol}
          totalSpent={totalSpent}
          spentBy={spentBy}
          onExportCsv={handleExportCSV}
          onExportJson={handleExportJSON}
          onImport={handleImport}
        />
      </div>

      <ExpensesTable expenses={sortedExpenses} currencySymbol={currencySymbol} onDelete={handleDeleteExpense} />
      <div className="card" style={{ marginTop: 14 }}>
        <h2>Expense Filters</h2>
        <div className="row3">
          <div>
            <label htmlFor="filterPaidBy">Paid By</label>
            <select id="filterPaidBy" value={filterPaidBy} onChange={(e) => setFilterPaidBy(e.target.value)}>
              <option value="">All</option>
              {participants.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filterStartDate">From Date</label>
            <input id="filterStartDate" type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="filterEndDate">To Date</label>
            <input id="filterEndDate" type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
          </div>
        </div>
        <div className="btnbar">
          <button type="button" onClick={() => void refreshExpenses()}>
            Apply Filters
          </button>
          <button
            type="button"
            onClick={() => {
              setFilterPaidBy("");
              setFilterStartDate("");
              setFilterEndDate("");
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>
      {currentUser.role === "admin" && <AuditTable logs={auditLogs} />}
      {currentUser.role === "admin" && (
        <UserManagement users={users} onCreate={createUser} onToggleActive={toggleUser} />
      )}
    </div>
  );
}

