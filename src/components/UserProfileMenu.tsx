"use client";

import { useEffect, useRef, useState } from "react";
import AccountSettingsModal from "@/components/AccountSettingsModal";
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
          {initials(user.username)}
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
          <div className="profile-dropdown-row">
            Signed in as <strong>{user.username}</strong>
          </div>
          <div className="profile-dropdown-row">
            Role: <strong style={{ textTransform: "capitalize" }}>{user.role}</strong>
          </div>
          <div className="profile-dropdown-row">
            Currency: <strong>{currencySymbol}</strong>
          </div>
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
