"use client";

import { useState } from "react";
import BrandMark from "@/components/BrandMark";
import { toast } from "react-toastify";
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
        const msg = data.error || "Login failed.";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Signed in.");
      onSuccess(data.user as SessionUser);
    } catch {
      setError("Login failed.");
      toast.error("Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <BrandMark size={48} className="app-brand-mark" />
          <h2 className="auth-title">Expense tracker</h2>
        </div>
        <p className="auth-sub">Sign in with your username or verified email.</p>
        <label htmlFor="loginUsername">Username or verified email</label>
        <input
          id="loginUsername"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
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

