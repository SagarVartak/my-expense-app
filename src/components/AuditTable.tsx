"use client";

import type { AuditLog } from "@/lib/types";

type Props = {
  logs: AuditLog[];
};

export default function AuditTable({ logs }: Props) {
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h2>Admin Audit Logs</h2>
      <div style={{ overflow: "auto", borderRadius: 12 }}>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No logs yet.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>{(log.created_at || "").replace("T", " ").replace("Z", "")}</td>
                  <td>{log.performed_by}</td>
                  <td>{log.action}</td>
                  <td>{log.details}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

