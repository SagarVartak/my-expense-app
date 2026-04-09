import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { isWebPushConfigured } from "@/lib/pushWeb";
import { getServerSupabase } from "@/lib/serverSupabase";

type Body = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(req: Request) {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Web Push is not configured (VAPID keys missing)." }, { status: 503 });
  }

  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Only admins can subscribe to approval alerts." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = String(body.endpoint ?? "").trim();
  const p256dh = String(body.keys?.p256dh ?? "").trim();
  const auth = String(body.keys?.auth ?? "").trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription payload." }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data: row, error: findErr } = await supabase.from("app_users").select("id").eq("username", user.username).maybeSingle();
  if (findErr || !row) {
    return NextResponse.json({ error: "User record not found." }, { status: 404 });
  }

  const appUserId = row.id as string;

  const { error: upsertErr } = await supabase.from("push_subscriptions").upsert(
    {
      app_user_id: appUserId,
      endpoint,
      p256dh,
      auth,
    },
    { onConflict: "endpoint" },
  );

  if (upsertErr) {
    if (/push_subscriptions|relation|does not exist/i.test(upsertErr.message)) {
      return NextResponse.json(
        { error: "Run supabase/migration_push_subscriptions.sql on your database." },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { endpoint?: string };
  try {
    body = (await req.json()) as { endpoint?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = String(body.endpoint ?? "").trim();
  if (!endpoint) {
    return NextResponse.json({ error: "endpoint is required." }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data: row } = await supabase.from("app_users").select("id").eq("username", user.username).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("app_user_id", row.id as string);

  return NextResponse.json({ ok: true });
}
