"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "react-toastify";
import type { SessionUser } from "@/lib/types";

type Props = {
  open: boolean;
  user: SessionUser;
  onClose: () => void;
  onUserUpdated: (user: SessionUser) => void;
};

export default function AccountSettingsModal({ open, user, onClose, onUserUpdated }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) return;
    setCurrentPassword("");
    setNewUsername("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = async () => {
    setError("");
    const uname = newUsername.trim().toLowerCase();
    const hasPwd = newPassword.length > 0 || confirmPassword.length > 0;
    if (hasPwd && newPassword !== confirmPassword) {
      toast.error("New password and confirmation must match.");
      return;
    }
    if (!uname && !newPassword) {
      toast.error("Enter a new username and/or a new password.");
      return;
    }
    if (!currentPassword) {
      toast.error("Current password is required.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = { currentPassword };
      if (uname) body.newUsername = uname;
      if (newPassword) body.newPassword = newPassword;

      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Update failed.";
        setError(msg);
        toast.error(msg);
        return;
      }
      toast.success("Account updated.");
      onUserUpdated(data.user as SessionUser);
      onClose();
    } catch {
      setError("Request failed.");
      toast.error("Request failed.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  if (typeof document === "undefined") return null;

  if (user.authMethod === "google") {
    return createPortal(
      <div
        className="modal-overlay modal-overlay--portal"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="modal-panel modal-panel--account card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-settings-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="account-settings-title" style={{ margin: "0 0 6px", fontSize: 16 }}>
            Account settings
          </h2>
          <p className="muted" style={{ margin: "0 0 14px", fontSize: 13 }}>
            You signed in with Google. Security and email are managed in your Google account; this app does not store a separate password for your
            user.
          </p>
          <div className="btnbar" style={{ marginTop: 14 }}>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className="modal-overlay modal-overlay--portal"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-panel modal-panel--account card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="account-settings-title" style={{ margin: "0 0 6px", fontSize: 16 }}>
          Account settings
        </h2>
        <p className="muted" style={{ margin: "0 0 14px", fontSize: 13 }}>
          Change your display username or password. Your current password is required for either change.
        </p>

        <label htmlFor="acct-current-pw">Current password</label>
        <input
          id="acct-current-pw"
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />

        <div style={{ marginTop: 12 }}>
          <label htmlFor="acct-new-user">New username (optional)</label>
          <input
            id="acct-new-user"
            type="text"
            autoComplete="username"
            placeholder={user.username}
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <label htmlFor="acct-new-pw">New password (optional)</label>
          <input
            id="acct-new-pw"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div style={{ marginTop: 10 }}>
          <label htmlFor="acct-confirm-pw">Confirm new password</label>
          <input
            id="acct-confirm-pw"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        {error ? <div className="auth-error" style={{ marginTop: 10 }}>{error}</div> : null}

        <div className="btnbar" style={{ marginTop: 14 }}>
          <button type="button" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
