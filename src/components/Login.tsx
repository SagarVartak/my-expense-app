"use client";

import { useMemo, useState } from "react";
import BrandMark from "@/components/BrandMark";
import { APP_NAME } from "@/lib/appMeta";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseAuthEnvConfigured } from "@/lib/supabase/publicEnv";
import { toast } from "react-toastify";
export default function Login() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const googleReady = useMemo(() => isSupabaseAuthEnvConfigured(), []);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oAuthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });
      if (oAuthError) {
        const msg = oAuthError.message || "Google sign-in failed.";
        setError(msg);
        toast.error(msg);
      }
    } catch {
      const msg = "Could not start Google sign-in. Check Supabase URL and anon key.";
      setError(msg);
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
        </div>

        <p className="auth-sub">Sign in with the Google account that matches your email in this app.</p>

        {googleReady ? (
          <button type="button" className="auth-google-btn" onClick={() => void signInWithGoogle()} disabled={loading}>
            {loading ? "Redirecting…" : "Continue with Google"}
          </button>
        ) : (
          <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
            Add <code style={{ fontSize: 12 }}>NEXT_PUBLIC_SUPABASE_URL</code> and an anon key:{" "}
            <code style={{ fontSize: 12 }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> or{" "}
            <code style={{ fontSize: 12 }}>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY</code> (same value from Supabase → API).
            Restart <code style={{ fontSize: 12 }}>npm run dev</code> after editing <code style={{ fontSize: 12 }}>.env</code>.
          </p>
        )}
        <div className="auth-error">{error}</div>
      </div>
    </div>
  );
}
