"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "react-toastify";
import BrandMark from "@/components/BrandMark";
import { APP_NAME } from "@/lib/appMeta";

function AcceptInviteForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      const msg = "Missing invite link. Open the link from your email.";
      setVerifyError(msg);
      toast.error(msg);
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
          const msg = data.error || "Invalid invite.";
          setVerifyError(msg);
          toast.error(msg);
        }
      } catch {
        const msg = "Could not verify invite.";
        setVerifyError(msg);
        toast.error(msg);
      } finally {
        setChecking(false);
      }
    };
    void run();
  }, [token]);

  const submit = async () => {
    setLoading(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Could not complete signup.";
        setSubmitError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Account ready. Sign in with Google using this email.");
      setDone(true);
    } catch {
      const msg = "Request failed.";
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <BrandMark size={48} className="app-brand-mark" />
          <h2 className="auth-title">{APP_NAME}</h2>
          <p className="auth-lead">Accept invite</p>
        </div>
        <p className="auth-sub">Verify your email, then sign in with Google on the main app.</p>

        {checking ? (
          <p className="muted">Checking invite…</p>
        ) : verifyError ? (
          <div className="auth-error">{verifyError}</div>
        ) : done ? (
          <p className="muted">
            You can close this tab and open the app. Use <strong style={{ color: "var(--text)" }}>Continue with Google</strong> with{" "}
            <strong style={{ color: "var(--text)" }}>{email}</strong>.
          </p>
        ) : valid ? (
          <>
            <div className="muted" style={{ marginBottom: 12 }}>
              Email: <strong style={{ color: "var(--text)" }}>{email}</strong>
            </div>
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
