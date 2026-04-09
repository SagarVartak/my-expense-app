"use client";

import { useCallback, useEffect, useState } from "react";
import { clientFetch } from "@/lib/clientFetch";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Props = {
  /** Called after successful subscribe so the parent can close the menu */
  onDone?: () => void;
};

/**
 * Lets an admin enable browser push for approval alerts (requires VAPID env + push_subscriptions migration).
 */
export default function AdminPushToggle({ onDone }: Props) {
  const [serverKey, setServerKey] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshSubscriptionState = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSubscribed(false);
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(Boolean(sub));
    } catch {
      setSubscribed(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setChecking(true);
      setMessage(null);
      try {
        const res = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          setServerKey(null);
          if (!cancelled) setMessage(typeof data.error === "string" ? data.error : "Push not configured.");
          return;
        }
        if (typeof data.publicKey === "string" && data.publicKey) {
          setServerKey(data.publicKey);
        } else {
          setServerKey(null);
        }
        await refreshSubscriptionState();
      } catch {
        if (!cancelled) setMessage("Could not reach push settings.");
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSubscriptionState]);

  const enable = async () => {
    if (!serverKey) return;
    setBusy(true);
    setMessage(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setMessage(perm === "denied" ? "Notifications blocked in browser settings." : "Permission not granted.");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await reg.update();
      await navigator.serviceWorker.ready;

      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(serverKey) as BufferSource,
        }));

      const res = await clientFetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(typeof data.error === "string" ? data.error : "Could not save subscription.");
        return;
      }
      setSubscribed(true);
      onDone?.();
    } catch (e) {
      setMessage((e as Error).message || "Could not enable push.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await clientFetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      onDone?.();
    } catch (e) {
      setMessage((e as Error).message || "Could not disable push.");
    } finally {
      setBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="profile-dropdown-row" style={{ fontSize: 12 }}>
        <span className="muted">Approval alerts…</span>
      </div>
    );
  }

  if (!serverKey) {
    return (
      <div className="profile-dropdown-row" style={{ fontSize: 12, lineHeight: 1.4 }}>
        <span className="muted">
          Browser push is off: add VAPID keys to the server env (see migration_push_subscriptions.sql).{" "}
          {message ? <span style={{ color: "var(--text)" }}>{message}</span> : null}
        </span>
      </div>
    );
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return (
      <div className="profile-dropdown-row" style={{ fontSize: 12 }}>
        <span className="muted">This browser does not support notifications.</span>
      </div>
    );
  }

  return (
    <div className="profile-dropdown-row" style={{ fontSize: 12, lineHeight: 1.45 }}>
      <div style={{ marginBottom: 8 }}>
        <strong style={{ color: "var(--text)", display: "block", marginBottom: 4 }}>Approval alerts</strong>
        <span className="muted">Get a browser notification when a member submits something to approve.</span>
      </div>
      {subscribed ? (
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => void disable()} style={{ width: "100%" }}>
          {busy ? "Turning off…" : "Turn off browser alerts"}
        </button>
      ) : (
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => void enable()} style={{ width: "100%" }}>
          {busy ? "Enabling…" : "Turn on browser alerts"}
        </button>
      )}
      {message ? (
        <div style={{ marginTop: 8, color: "var(--text)", fontSize: 11 }}>{message}</div>
      ) : null}
    </div>
  );
}
