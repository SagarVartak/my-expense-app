"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type NavKey = "orderApprovals" | "designChangeApprovals" | "deletionApprovals";

export type AdminRealtimePayload = {
  title: string;
  body: string;
  nav?: string | null;
};

type Props = {
  enabled: boolean;
  onAlert: (payload: AdminRealtimePayload) => void;
};

/**
 * Subscribes to `admin_alert_events` INSERTs via Supabase Realtime (while the app is open).
 */
export default function AdminRealtimeListener({ enabled, onAlert }: Props) {
  useEffect(() => {
    if (!enabled) return;

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("admin_alert_events_inserts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "admin_alert_events" },
        (payload) => {
          const row = payload.new as { title?: string; body?: string; nav?: string | null };
          onAlert({
            title: typeof row.title === "string" ? row.title : "Approval needed",
            body: typeof row.body === "string" ? row.body : "",
            nav: row.nav ?? null,
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, onAlert]);

  return null;
}

export function isKnownApprovalNav(nav: string | null | undefined): nav is NavKey {
  return nav === "orderApprovals" || nav === "designChangeApprovals" || nav === "deletionApprovals";
}
