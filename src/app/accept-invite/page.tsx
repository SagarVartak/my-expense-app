"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      setVerifyError("Missing invite link. Open the link from your email.");
      return;
    }
    const run = async () => {
      setChecking(true);
      try {
        const res = await fetch(`/api/invites/verify?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const data = await res.json();
        if (data.valid) {
          setValid(true);
          setEmail(data.email || "");
        } else {
          setVerifyError(data.error || "Invalid invite.");
        }
      } catch {
        setVerifyError("Could not verify invite.");
      } finally {
        setChecking(false);
      }
    };
    void run();
  }, [token]);

  const submit = async () => {
    if (password.length < 6) {
      setSubmitError("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Could not complete signup.");
        return;
      }
      setDone(true);
    } catch {
      setSubmitError("Request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2 className="auth-title">Accept invite</h2>
        <p className="auth-sub">Verify your email and choose a password to activate your account.</p>

        {checking ? (
          <p className="muted">Checking invite…</p>
        ) : verifyError ? (
          <div className="auth-error">{verifyError}</div>
        ) : done ? (
          <p className="muted">Account ready. You can close this tab and log in with your email and password.</p>
        ) : valid ? (
          <>
            <div className="muted" style={{ marginBottom: 12 }}>
              Email: <strong style={{ color: "var(--text)" }}>{email}</strong>
            </div>
            <label htmlFor="invitePass">Password</label>
            <input
              id="invitePass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <div className="btnbar">
              <button type="button" onClick={submit} disabled={loading}>
                {loading ? "Saving…" : "Activate account"}
              </button>
            </div>
            <div className="auth-error">{submitError}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="auth-shell">
          <div className="auth-card">
            <p className="muted">Loading…</p>
          </div>
        </div>
      }
    >
      <AcceptInviteForm />
    </Suspense>
  );
}
