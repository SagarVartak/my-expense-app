import { APP_NAME } from "@/lib/appMeta";

/** Public app origin for links in emails (invites, admin notifications). */
export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export function buildAcceptInviteUrl(token: string): string {
  return `${appBaseUrl()}/accept-invite?token=${encodeURIComponent(token)}`;
}

/** Sends invite email via Resend when RESEND_API_KEY is set; otherwise logs the link (dev). */
export async function sendInviteEmail(to: string, acceptUrl: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || `${APP_NAME} <onboarding@resend.dev>`;

  if (!key) {
    console.warn("[invite] RESEND_API_KEY not set — invite link (share manually):", acceptUrl);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `You're invited to ${APP_NAME}`,
      html: `<p>You were invited to join <strong>${APP_NAME}</strong>.</p><p><a href="${acceptUrl}">Verify your email</a> to activate your account.</p><p>This link expires in 7 days.</p>`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Email send failed: ${res.status} ${text}`);
  }
}

/** Notify admins (e.g. pending approvals). Requires RESEND_API_KEY; otherwise logs and returns. */
export async function sendAdminNotificationEmails(to: string[], subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || `${APP_NAME} <onboarding@resend.dev>`;
  if (!key) {
    console.warn("[admin-notify] RESEND_API_KEY not set —", subject);
    return;
  }
  if (to.length === 0) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(
      `[admin-notify] Resend failed (${res.status}). Check RESEND_API_KEY, RESEND_FROM_EMAIL, and that your sending domain is verified in Resend. ${text}`,
    );
  }
}
