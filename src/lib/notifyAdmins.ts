import { insertAdminAlertEvent, type AdminAlertKind } from "@/lib/adminAlertEvents";
import { sendAdminNotificationEmails } from "@/lib/email";
import { sendWebPushToAdmins } from "@/lib/pushWeb";
import { getServerSupabase } from "@/lib/serverSupabase";

function htmlToPlainSnippet(html: string, max = 160): string {
  const t = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/**
 * Email + optional Web Push + Supabase Realtime row for active admins.
 * Email needs RESEND_*; push needs VAPID + push_subscriptions; realtime needs admin_alert_events migration.
 */
export async function notifyAdminsPendingApproval(params: {
  subject: string;
  htmlBody: string;
  kind: AdminAlertKind;
  /** `nav` query value for in-app navigation and push tap URL */
  nav?: string;
}): Promise<void> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("app_users")
    .select("email")
    .eq("role", "admin")
    .eq("active", true);
  if (error) {
    console.warn("[notifyAdmins]", error.message);
    return;
  }
  const emails = [
    ...new Set(
      (data ?? [])
        .map((r) => String((r as { email?: string | null }).email || "").trim().toLowerCase())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
    ),
  ];

  const plain = htmlToPlainSnippet(params.htmlBody);
  const openPath = params.nav ? `/?nav=${encodeURIComponent(params.nav)}` : "/";

  await Promise.all([
    emails.length > 0 ? sendAdminNotificationEmails(emails, params.subject, params.htmlBody) : Promise.resolve(),
    sendWebPushToAdmins({
      title: params.subject,
      body: plain || "Open the app to review.",
      openPath,
    }),
    insertAdminAlertEvent({
      kind: params.kind,
      title: params.subject,
      body: plain || "",
      nav: params.nav ?? null,
    }),
  ]);
}
