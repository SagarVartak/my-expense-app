"use client";

import { useEffect, useRef, useState } from "react";
import AccountSettingsModal from "@/components/AccountSettingsModal";
import AdminPushToggle from "@/components/AdminPushToggle";
import type { SessionUser } from "@/lib/types";

type Props = {
  user: SessionUser;
  currencySymbol: string;
  onLogout: () => void;
  onUserUpdated: (user: SessionUser) => void;
};

function initials(username: string) {
  const parts = username.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  const u = parts[0] || "?";
  return u.slice(0, 2).toUpperCase();
}

export default function UserProfileMenu({ user, currencySymbol, onLogout, onUserUpdated }: Props) {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const logout = async () => {
    setOpen(false);
    await onLogout();
  };

  return (
    <div className="profile-menu" ref={rootRef}>
      <button
        type="button"
        className="profile-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="profile-avatar" aria-hidden>
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            initials(user.username)
          )}
        </span>
        <span className="profile-trigger-text">
          <span className="profile-name">{user.username}</span>
          <span className="profile-role">{user.role}</span>
        </span>
        <span className="profile-chevron" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="profile-dropdown" role="menu">
          <div className="profile-dropdown-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="profile-avatar" style={{ width: 36, height: 36, flexShrink: 0 }}>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                initials(user.username)
              )}
            </span>
            <div>
              <div>Signed in as <strong>{user.username}</strong></div>
              <div className="muted" style={{ fontSize: 12 }}>Role: {user.role}</div>
            </div>
          </div>
          <div className="profile-dropdown-row">
            Currency: <strong>{currencySymbol}</strong>
          </div>
          {user.role === "admin" ? (
            <>
              <div className="hr" style={{ margin: "10px 0", opacity: 0.5 }} />
              <AdminPushToggle onDone={() => setOpen(false)} />
            </>
          ) : null}
          <div className="profile-dropdown-actions profile-dropdown-actions-stack">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setAccountOpen(true);
              }}
            >
              Account settings
            </button>
            <button type="button" role="menuitem" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        </div>
      ) : null}
      <AccountSettingsModal
        open={accountOpen}
        user={user}
        onClose={() => setAccountOpen(false)}
        onUserUpdated={(u) => {
          onUserUpdated(u);
          setAccountOpen(false);
        }}
      />
    </div>
  );
}
