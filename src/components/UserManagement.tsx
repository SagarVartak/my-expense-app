"use client";

import { useState } from "react";
import type { AppUser, Role } from "@/lib/types";

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

  return (
    <div className="card" style={{ marginTop: 14 }}>
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
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
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

