"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppUser, PendingInvite, Role } from "@/lib/types";

type Props = {
  users: AppUser[];
  onCreate: (payload: { username: string; password: string; role: Role }) => Promise<void>;
  onToggleActive: (id: string, active: boolean) => Promise<void>;
};

export default function UserManagement({ users, onCreate, onToggleActive }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [hint, setHint] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteHint, setInviteHint] = useState("");
  const [invites, setInvites] = useState<PendingInvite[]>([]);

  const loadInvites = useCallback(async () => {
    const res = await fetch("/api/invites", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setInvites((data.invites || []) as PendingInvite[]);
  }, []);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

  const submit = async () => {
    if (!username.trim() || password.length < 6) {
      setHint("Username required. Password must be at least 6 characters.");
      return;
    }
    await onCreate({ username: username.trim().toLowerCase(), password, role });
    setUsername("");
    setPassword("");
    setRole("member");
    setHint("User created.");
  };

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInviteHint("Enter a valid email.");
      return;
    }
    setInviteHint("");
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      setInviteHint(data.error || "Invite failed.");
      return;
    }
    setInviteEmail("");
    setInviteHint("Invite sent. They must open the email link to verify and set a password.");
    await loadInvites();
  };

  return (
    <div className="card">
      <h2>Invite by email</h2>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
        Sends a link so the recipient can verify their email and choose a password. Configure{" "}
        <code style={{ fontSize: 12 }}>RESEND_API_KEY</code> and <code style={{ fontSize: 12 }}>NEXT_PUBLIC_APP_URL</code>{" "}
        for production email delivery; otherwise the link is logged on the server for manual sharing.
      </p>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="inviteEmail">Email</label>
          <input id="inviteEmail" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
        </div>
        <button type="button" onClick={sendInvite}>
          Send invite
        </button>
      </div>
      <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
        {inviteHint}
      </div>

      {invites.length > 0 ? (
        <div style={{ overflow: "auto", borderRadius: 12, marginTop: 14 }}>
          <table>
            <thead>
              <tr>
                <th>Email</th>
                <th>Expires</th>
                <th>Invited by</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.email}</td>
                  <td>{(inv.expires_at || "").replace("T", " ").replace("Z", "").slice(0, 16)}</td>
                  <td>{inv.created_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="hr" style={{ margin: "18px 0" }} />

      <h2>Admin User Management</h2>
      <div className="row3">
        <div>
          <label htmlFor="newUserName">Username</label>
          <input id="newUserName" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label htmlFor="newUserPass">Password</label>
          <input id="newUserPass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label htmlFor="newUserRole">Role</label>
          <select id="newUserRole" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </div>
      <div className="btnbar">
        <button type="button" onClick={submit}>
          Create User
        </button>
        <span className="muted">{hint}</span>
      </div>

      <div style={{ overflow: "auto", borderRadius: 12, marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td className="muted">{u.email || "—"}</td>
                <td>{u.role}</td>
                <td>{u.active ? "active" : "disabled"}</td>
                <td>
                  <button type="button" onClick={() => onToggleActive(u.id, !u.active)}>
                    {u.active ? "Disable" : "Enable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
