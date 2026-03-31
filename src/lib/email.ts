function appBaseUrl(): string {
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
  const from = process.env.RESEND_FROM_EMAIL || "Expense App <onboarding@resend.dev>";

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
      subject: "You're invited to the expense tracker",
      html: `<p>You were invited to join the team expense tracker.</p><p><a href="${acceptUrl}">Verify your email and set a password</a> to activate your account.</p><p>This link expires in 7 days.</p>`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Email send failed: ${res.status} ${text}`);
  }
}
