import { getServerSupabase } from "@/lib/serverSupabase";

export type AdminAlertKind = "order_new" | "order_edit" | "design_change" | "deletion";

/**
 * Inserts a row so subscribed admin clients receive a Realtime INSERT (in-app toast).
 * Service role bypasses RLS. Safe to call when the migration is not applied yet (logs in dev).
 */
export async function insertAdminAlertEvent(params: {
  kind: AdminAlertKind;
  title: string;
  body: string;
  /** `nav` query value, e.g. orderApprovals — matches Home deep links */
  nav?: string | null;
}): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase.from("admin_alert_events").insert({
    kind: params.kind,
    title: params.title,
    body: params.body,
    nav: params.nav ?? null,
  });
  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[adminAlertEvents]", error.message);
    }
  }
}
