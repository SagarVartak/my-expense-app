"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import Login from "@/components/Login";
import Summary from "@/components/Summary";
import UserProfileMenu from "@/components/UserProfileMenu";
import BrandMark from "@/components/BrandMark";
import CostPriceCalculator from "@/components/CostPriceCalculator";
import ExpensesTable from "@/components/ExpensesTable";
import SavedCostDesignsTable from "@/components/SavedCostDesignsTable";
import AuditTable from "@/components/AuditTable";
import UserManagement from "@/components/UserManagement";
import DesignChangeRequestsPanel from "@/components/DesignChangeRequestsPanel";
import OrderApprovalsPanel from "@/components/OrderApprovalsPanel";
import OrderLedger from "@/components/OrderLedger";
import OrdersTable from "@/components/OrdersTable";
import type { AppUser, AuditLog, Expense, SessionUser } from "@/lib/types";

type NavId =
  | "expenses"
  | "summary"
  | "costCalculator"
  | "savedDesigns"
  | "orders"
  | "orderLedger"
  | "designApprovals"
  | "audit"
  | "users";

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
  const [filterPaidBy, setFilterPaidBy] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterEntryUid, setFilterEntryUid] = useState("");
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const currencySymbol = "₹";
  const appName = "Expense tracker";
  const [activeNav, setActiveNav] = useState<NavId>("expenses");
  const sessionNavKey = useRef<string | null>(null);
  const deepLinkNavApplied = useRef(false);

  useEffect(() => {
    if (!currentUser) {
      sessionNavKey.current = null;
      return;
    }
    const key = `${currentUser.username}:${currentUser.role}`;
    if (sessionNavKey.current === key) return;
    sessionNavKey.current = key;
    if (currentUser.role === "member") {
      setActiveNav("expenses");
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !loaded || deepLinkNavApplied.current) return;
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    const nav = params.get("nav");
    const map: Record<string, NavId> = {
      expenses: "expenses",
      summary: "summary",
      costCalculator: "costCalculator",
      savedDesigns: "savedDesigns",
      orders: "orders",
      orderLedger: "orderLedger",
      designApprovals: "designApprovals",
      audit: "audit",
      users: "users",
    };
    if (!nav || !map[nav]) return;
    const id = map[nav];
    if ((id === "audit" || id === "users" || id === "designApprovals") && currentUser.role !== "admin") return;
    deepLinkNavApplied.current = true;
    setActiveNav(id);
    window.history.replaceState(null, "", "/");
  }, [currentUser, loaded]);

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
    if (filterEntryUid.trim() && currentUser?.role === "admin") qs.set("entryUid", filterEntryUid.trim());
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const res = await fetch(`/api/expenses${suffix}`, { cache: "no-store" });
    const data = await res.json();
    setExpenses((data.expenses || []) as Expense[]);
  }, [currentUser?.role, filterEndDate, filterEntryUid, filterPaidBy, filterStartDate]);

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

  const refreshMemberNames = useCallback(async () => {
    const res = await fetch("/api/team-members", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setMemberNames((data.names || []) as string[]);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const run = async () => {
      await refreshExpenses();
      await refreshLogs();
      await refreshUsers();
      await refreshMemberNames();
    };
    void run();
  }, [currentUser, refreshExpenses, refreshLogs, refreshUsers, refreshMemberNames]);

  useEffect(() => {
    if (!currentUser) return;
    void refreshExpenses();
  }, [currentUser, filterEntryUid, filterPaidBy, filterStartDate, filterEndDate, refreshExpenses]);

  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);
  const [costDesignRefresh, setCostDesignRefresh] = useState(0);
  const [orderLedgerRefresh, setOrderLedgerRefresh] = useState(0);
  const [approvalRefresh, setApprovalRefresh] = useState(0);

  const notifyCostDesignAudit = useCallback(() => {
    if (currentUser?.role === "admin") void refreshLogs();
  }, [currentUser?.role, refreshLogs]);

  const handleRefreshAll = useCallback(async () => {
    if (!currentUser || refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    try {
      const tasks: Promise<unknown>[] = [refreshExpenses(), refreshMemberNames()];
      if (currentUser.role === "admin") {
        tasks.push(refreshLogs(), refreshUsers());
      }
      await Promise.all(tasks);
      setCostDesignRefresh((k) => k + 1);
      setOrderLedgerRefresh((k) => k + 1);
      setApprovalRefresh((k) => k + 1);
      toast.success("Data updated.");
    } catch {
      toast.error("Could not refresh data.");
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  }, [currentUser, refreshExpenses, refreshLogs, refreshMemberNames, refreshUsers]);

  const participants = useMemo(() => {
    const set = new Set(expenses.map((e) => e.paid_by).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [expenses]);

  const filterPaidByOptions = useMemo(() => {
    const set = new Set([...memberNames, ...participants]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [memberNames, participants]);

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
    toast.info("Signed out.");
    setCurrentUser(null);
    setExpenses([]);
    setAuditLogs([]);
  };

  const handleAddExpense = async () => {
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error("Enter a valid amount greater than zero.");
      return;
    }
    if (!paidBy.trim()) {
      toast.error("Select who paid this expense.");
      return;
    }
    if (memberNames.length > 0 && !memberNames.includes(paidBy.trim())) {
      toast.error("Choose a team member from the Paid By list.");
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
      toast.error("Failed to add expense.");
      return;
    }

    await writeAudit("ADD_EXPENSE", `${payload.paid_by} spent ${currencySymbol}${money(payload.amount)} on ${payload.category}`);
    await refreshExpenses();
    if (currentUser?.role === "admin") await refreshLogs();

    setAmount("");
    setPaidBy("");
    setDescription("");
    setPaymentMethod(PAYMENT_METHODS[0]);
    toast.success("Expense added.");
  };

  const handleDeleteExpense = async (id: string) => {
    const target = expenses.find((e) => e.id === id);
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      let msg = "Could not delete expense.";
      try {
        const d = await res.json();
        if (typeof d.error === "string") msg = d.error;
      } catch {
        /* ignore */
      }
      toast.error(msg);
      return;
    }

    if (target) {
      const ref = target.entry_uid ? `${target.entry_uid} ` : "";
      await writeAudit(
        "DELETE_EXPENSE",
        `${ref}${target.paid_by} ${currencySymbol}${money(Number(target.amount))} (${target.category})`,
      );
    }
    await refreshExpenses();
    if (currentUser?.role === "admin") await refreshLogs();
    toast.success(target?.entry_uid ? `Deleted ${target.entry_uid}.` : "Expense deleted.");
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
    toast.success(`All expense data cleared (${toDelete.length} removed).`);
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
    const headers = ["entryUid", "date", "category", "description", "paidBy", "paymentMethod", "amount"];
    const rows = sortedExpenses.map((e) =>
      [e.entry_uid ?? "", e.expense_date, e.category, e.description, e.paid_by, e.payment_method, Number(e.amount)]
        .map(csvEscape)
        .join(","),
    );
    downloadTextFile("expenses.csv", [headers.join(","), ...rows].join("\n"), "text/csv");
    await writeAudit("EXPORT_CSV", `Exported ${expenses.length} expense rows`);
    if (currentUser?.role === "admin") await refreshLogs();
    toast.info(`Exported ${expenses.length} row(s) to CSV.`);
  };

  const handleExportJSON = async () => {
    downloadTextFile("expenses-backup.json", JSON.stringify(expenses, null, 2), "application/json");
    await writeAudit("EXPORT_JSON", "Exported expenses JSON");
    if (currentUser?.role === "admin") await refreshLogs();
    toast.info("Expense backup downloaded (JSON).");
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
      toast.success(`Imported ${file.name}.`);
    } catch {
      toast.error("Import failed. Check the file format.");
    }
  };

  const createUser = async (payload: { username: string; password: string; role: "admin" | "member" }) => {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data: { error?: string } = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      toast.error(typeof data.error === "string" ? data.error : "Could not create user.");
      return false;
    }
    toast.success(`User "${payload.username}" created.`);
    await writeAudit("CREATE_USER", `Created user ${payload.username} (${payload.role})`);
    await refreshUsers();
    await refreshMemberNames();
    await refreshLogs();
    return true;
  };

  const toggleUser = async (id: string, active: boolean) => {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    let data: { error?: string } = {};
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      toast.error(typeof data.error === "string" ? data.error : "Could not update user.");
      return false;
    }
    toast.success(active ? "User enabled." : "User disabled.");
    await writeAudit("TOGGLE_USER", `${active ? "Enabled" : "Disabled"} user id ${id}`);
    await refreshUsers();
    await refreshMemberNames();
    await refreshLogs();
    return true;
  };

  if (!loaded) return null;
  if (!currentUser) return <Login onSuccess={setCurrentUser} />;

  const navBtnClass = (id: NavId) =>
    `nav-btn${activeNav === id ? " nav-btn-active" : ""}`;

  return (
    <div className="app-shell">
      <header className="app-top">
        <div className="app-brand">
          <BrandMark size={44} className="app-brand-mark" />
          <div className="app-brand-text">
            <h1 className="app-brand-title">{appName}</h1>
            <p className="app-brand-sub">Track spending, totals by payer, and backups.</p>
          </div>
        </div>
        <div className="app-top-actions">
          <button
            type="button"
            className="app-refresh-btn"
            onClick={() => void handleRefreshAll()}
            disabled={refreshing}
            title="Refresh data"
            aria-label={refreshing ? "Refreshing…" : "Refresh data from server"}
          >
            <span className={`app-refresh-icon${refreshing ? " app-refresh-icon--spin" : ""}`} aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </span>
          </button>
        <UserProfileMenu
          user={currentUser}
          currencySymbol={currencySymbol}
          onLogout={handleLogout}
          onUserUpdated={(u) => {
            setCurrentUser(u);
            void refreshMemberNames();
            if (u.role === "admin") {
              void refreshLogs();
              void (async () => {
                const res = await fetch("/api/users", { cache: "no-store" });
                if (!res.ok) return;
                const data = await res.json();
                setUsers((data.users || []) as AppUser[]);
              })();
            }
          }}
        />
        </div>
      </header>

      <div className="app-body">
        <nav className="app-sidebar" aria-label="Main navigation">
          <div className="sidebar-label">Menu</div>
          <button type="button" className={navBtnClass("expenses")} onClick={() => setActiveNav("expenses")}>
            Expenses
          </button>
          <button type="button" className={navBtnClass("summary")} onClick={() => setActiveNav("summary")}>
            Summary &amp; data
          </button>
          <button type="button" className={navBtnClass("costCalculator")} onClick={() => setActiveNav("costCalculator")}>
            Cost Price Calculator
          </button>
          <button type="button" className={navBtnClass("savedDesigns")} onClick={() => setActiveNav("savedDesigns")}>
            Saved designs
          </button>
          <button type="button" className={navBtnClass("orders")} onClick={() => setActiveNav("orders")}>
            Orders
          </button>
          <button type="button" className={navBtnClass("orderLedger")} onClick={() => setActiveNav("orderLedger")}>
            Order Ledger
          </button>
          {currentUser.role === "admin" ? (
            <>
              <button
                type="button"
                className={navBtnClass("designApprovals")}
                onClick={() => setActiveNav("designApprovals")}
              >
                Approvals
              </button>
              <button type="button" className={navBtnClass("audit")} onClick={() => setActiveNav("audit")}>
                Audit log
              </button>
              <button type="button" className={navBtnClass("users")} onClick={() => setActiveNav("users")}>
                Team
              </button>
            </>
          ) : null}
        </nav>

        <main className="app-main">
          {activeNav === "expenses" ? (
            <>
              <section className="card">
                <h2>Add expense</h2>
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
                    <select id="paidBy" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                      <option value="">Select team member</option>
                      {memberNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    {memberNames.length === 0 ? (
                      <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                        Loading team members…
                      </div>
                    ) : null}
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
                </div>
                <div className="footer-actions">
                  <div className="muted">{expenses.length} expenses</div>
                  <button className="btn-danger" type="button" onClick={handleResetAll}>
                    Reset All Data
                  </button>
                </div>
              </section>

              <section className="card">
                <h2>Filters</h2>
                <div className="row3">
                  <div>
                    <label htmlFor="filterPaidBy">Paid By</label>
                    <select id="filterPaidBy" value={filterPaidBy} onChange={(e) => setFilterPaidBy(e.target.value)}>
                      <option value="">All</option>
                      {filterPaidByOptions.map((p) => (
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
                {currentUser.role === "admin" ? (
                  <div style={{ marginTop: 10 }}>
                    <label htmlFor="filterEntryUid">Entry ID lookup (admin)</label>
                    <input
                      id="filterEntryUid"
                      placeholder="e.g. EXP-9K3FJ2A1"
                      value={filterEntryUid}
                      onChange={(e) => setFilterEntryUid(e.target.value)}
                    />
                    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                      Finds the row with this public entry id; combine with other filters if needed.
                    </div>
                  </div>
                ) : null}
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
                      setFilterEntryUid("");
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
              </section>

              <ExpensesTable
                expenses={sortedExpenses}
                currencySymbol={currencySymbol}
                canDelete={currentUser.role === "admin"}
                onDelete={handleDeleteExpense}
              />
            </>
          ) : null}

          {activeNav === "summary" ? (
            <Summary
              currencySymbol={currencySymbol}
              totalSpent={totalSpent}
              spentBy={spentBy}
              onExportCsv={handleExportCSV}
              onExportJson={handleExportJSON}
              onImport={handleImport}
            />
          ) : null}

          {activeNav === "costCalculator" ? (
            <CostPriceCalculator
              currencySymbol={currencySymbol}
              currentUser={currentUser}
              refreshSignal={costDesignRefresh}
              onCostDesignMutated={notifyCostDesignAudit}
              onChangeRequestSubmitted={() => {
                setApprovalRefresh((k) => k + 1);
                notifyCostDesignAudit();
              }}
            />
          ) : null}

          {activeNav === "savedDesigns" ? (
            <>
              <p className="muted" style={{ margin: "0 0 4px", fontSize: 14 }}>
                Same data as under <strong style={{ color: "var(--text)" }}>Cost Price Calculator</strong> — add new
                rows from the calculator tab.
              </p>
              <SavedCostDesignsTable
                currencySymbol={currencySymbol}
                currentUser={currentUser}
                refreshSignal={costDesignRefresh}
                onCostDesignMutated={notifyCostDesignAudit}
                onChangeRequestSubmitted={() => {
                  setApprovalRefresh((k) => k + 1);
                  notifyCostDesignAudit();
                }}
                emptyHint='No designs saved yet. Open Cost Price Calculator and click "Add design".'
              />
            </>
          ) : null}

          {activeNav === "orders" ? (
            <>
              <p className="muted" style={{ margin: "0 0 4px", fontSize: 14 }}>
                All orders from the ledger. Add new orders under <strong style={{ color: "var(--text)" }}>Order Ledger</strong>.
              </p>
              <OrdersTable
                currencySymbol={currencySymbol}
                currentUser={currentUser}
                refreshSignal={orderLedgerRefresh}
                onOrderMutated={() => {
                  notifyCostDesignAudit();
                  setApprovalRefresh((k) => k + 1);
                  setOrderLedgerRefresh((k) => k + 1);
                }}
              />
            </>
          ) : null}

          {activeNav === "orderLedger" ? (
            <OrderLedger
              currencySymbol={currencySymbol}
              onOrderMutated={() => {
                notifyCostDesignAudit();
                setApprovalRefresh((k) => k + 1);
                setOrderLedgerRefresh((k) => k + 1);
              }}
            />
          ) : null}

          {activeNav === "designApprovals" && currentUser.role === "admin" ? (
            <>
              <DesignChangeRequestsPanel
                currencySymbol={currencySymbol}
                refreshSignal={approvalRefresh}
                onMutated={notifyCostDesignAudit}
                onApplied={() => setCostDesignRefresh((k) => k + 1)}
              />
              <OrderApprovalsPanel
                currencySymbol={currencySymbol}
                refreshSignal={approvalRefresh}
                onMutated={notifyCostDesignAudit}
                onOrderApplied={() => setOrderLedgerRefresh((k) => k + 1)}
              />
            </>
          ) : null}
          {activeNav === "audit" && currentUser.role === "admin" ? <AuditTable logs={auditLogs} /> : null}
          {activeNav === "users" && currentUser.role === "admin" ? (
            <UserManagement users={users} onCreate={createUser} onToggleActive={toggleUser} />
          ) : null}
        </main>
      </div>
    </div>
  );
}

