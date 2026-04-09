import { sendAdminNotificationEmails } from "@/lib/email";
import { getServerSupabase } from "@/lib/serverSupabase";
import { sendWebPushToAdmins } from "@/lib/pushWeb";

function htmlToPlainSnippet(html: string, max = 160): string {
  const t = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

/**
 * Email + Web Push all active admins. Email needs RESEND_* and verified domain; push needs VAPID + migration.
 * Call from API routes after a member submits something pending admin approval.
 */
export async function notifyAdminsPendingApproval(params: {
  subject: string;
  htmlBody: string;
  /** Relative URL path for push tap target, e.g. /?nav=orderApprovals */
  openPath?: string;
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

  await Promise.all([
    emails.length > 0
      ? sendAdminNotificationEmails(emails, params.subject, params.htmlBody)
      : Promise.resolve(),
    sendWebPushToAdmins({
      title: params.subject,
      body: plain || "Open the app to review.",
      openPath: params.openPath ?? "/",
    }),
  ]);
}
