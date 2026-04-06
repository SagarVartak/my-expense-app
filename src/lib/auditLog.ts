import { getServerSupabase } from "@/lib/serverSupabase";

/** Best-effort insert; failures are logged and do not throw (main action should still succeed). */
export async function insertAuditLog(performedBy: string, action: string, details: string): Promise<void> {
  try {
    const supabase = getServerSupabase();
    const { error } = await supabase.from("audit_logs").insert({
      performed_by: performedBy,
      action,
      details: details.length > 8000 ? `${details.slice(0, 7997)}…` : details,
    });
    if (error) console.error("[audit log]", error.message);
  } catch (e) {
    console.error("[audit log]", e);
  }
}
