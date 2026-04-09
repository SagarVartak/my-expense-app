"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import type { AppUser, PendingInvite, Role } from "@/lib/types";

type Props = {
  users: AppUser[];
  onCreate: (payload: { username: string; role: Role; email: string }) => Promise<boolean>;
  onToggleActive: (id: string, active: boolean) => Promise<boolean>;
};

export default function UserManagement({ users, onCreate, onToggleActive }: Props) {
  const [username, setUsername] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [role, setRole] = useState<Role>("member");

  const [inviteEmail, setInviteEmail] = useState("");
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
    const u = username.trim().toLowerCase();
    if (!u) {
      toast.error("Username is required.");
      return;
    }
    const email = googleEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid Google email (must match their Google account).");
      return;
    }
    const ok = await onCreate({ username: u, role, email });
    if (ok) {
      setUsername("");
      setGoogleEmail("");
      setRole("member");
    }
  };

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Enter a valid email address.");
      return;
    }
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(typeof data.error === "string" ? data.error : "Invite failed.");
      return;
    }
    setInviteEmail("");
    toast.success("Invite sent. They verify email, then sign in with Google.");
    await loadInvites();
  };

  return (
    <div className="card">
      <h2>Invite by email</h2>
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
        Sends a link to verify email. After accepting, they sign in with <strong style={{ color: "var(--text)" }}>Continue with Google</strong> using
        that address. Configure <code style={{ fontSize: 12 }}>RESEND_API_KEY</code> and <code style={{ fontSize: 12 }}>NEXT_PUBLIC_APP_URL</code> for
        production email; otherwise the link is logged on the server.
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
      <p className="muted" style={{ margin: "0 0 12px", fontSize: 13 }}>
        <strong style={{ color: "var(--text)" }}>Admins and members</strong> sign in with Google only — set an email that matches their Google account.
      </p>
      <div className="row3">
        <div>
          <label htmlFor="newUserName">Username</label>
          <input id="newUserName" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div>
          <label htmlFor="googleEmail">Google email</label>
          <input
            id="googleEmail"
            type="email"
            placeholder="name@gmail.com"
            value={googleEmail}
            onChange={(e) => setGoogleEmail(e.target.value)}
          />
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
      </div>

      <div style={{ overflow: "auto", borderRadius: 12, marginTop: 10 }}>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Google</th>
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
                <td className="muted">{u.auth_user_id ? "linked" : u.email ? "pending" : "—"}</td>
                <td>{u.active ? "active" : "disabled"}</td>
                <td>
                  <button type="button" onClick={() => void onToggleActive(u.id, !u.active)}>
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
