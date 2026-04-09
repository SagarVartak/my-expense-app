import webpush from "web-push";
import { appBaseUrl } from "@/lib/email";
import { getServerSupabase } from "@/lib/serverSupabase";

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim() &&
      process.env.VAPID_SUBJECT?.trim(),
  );
}

function configureWebPush(): boolean {
  if (!isWebPushConfigured()) return false;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY!.trim();
  const subject = process.env.VAPID_SUBJECT!.trim();
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export type AdminPushPayload = {
  title: string;
  body: string;
  /** Path + query only, e.g. /?nav=orderApprovals — opened when the user taps the notification */
  openPath?: string;
};

/**
 * Sends a Web Push to every stored subscription for active admins.
 * Removes subscriptions that return 404/410 (expired).
 */
export async function sendWebPushToAdmins(payload: AdminPushPayload): Promise<void> {
  if (!configureWebPush()) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[push] Web Push not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT (e.g. mailto:you@domain.com).",
      );
    }
    return;
  }

  const supabase = getServerSupabase();
  const { data: admins, error: adminErr } = await supabase.from("app_users").select("id").eq("role", "admin").eq("active", true);
  if (adminErr || !admins?.length) return;

  const adminIds = admins.map((a) => a.id as string);
  const { data: subs, error: subErr } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, app_user_id")
    .in("app_user_id", adminIds);

  if (subErr || !subs?.length) return;

  const base = appBaseUrl().replace(/\/$/, "");
  const path = payload.openPath?.startsWith("/") ? payload.openPath : `/${payload.openPath ?? ""}`;
  const url = `${base}${path}`;

  const data = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url,
  });

  for (const row of subs) {
    const subscription = {
      endpoint: row.endpoint as string,
      keys: {
        p256dh: row.p256dh as string,
        auth: row.auth as string,
      },
    };

    try {
      await webpush.sendNotification(subscription as webpush.PushSubscription, data, {
        TTL: 60 * 60,
      });
    } catch (e: unknown) {
      const status = (e as { statusCode?: number })?.statusCode;
      if (status === 410 || status === 404) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", row.endpoint as string);
      } else if (process.env.NODE_ENV === "development") {
        console.warn("[push] send failed:", e);
      }
    }
  }
}
