"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/types";

type Props = {
  onSuccess: (user: SessionUser) => void;
};

export default function Login({ onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      onSuccess(data.user as SessionUser);
    } catch {
      setError("Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2 className="auth-title">Expense Tracker Login</h2>
        <p className="auth-sub">Only authorized team members can access this sheet.</p>
        <label htmlFor="loginUsername">Username</label>
        <input id="loginUsername" value={username} onChange={(e) => setUsername(e.target.value)} />
        <div style={{ marginTop: 10 }}>
          <label htmlFor="loginPassword">Password</label>
          <input
            id="loginPassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        <div className="btnbar">
          <button type="button" onClick={submit} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </div>
        <div className="auth-error">{error}</div>
      </div>
    </div>
  );
}

