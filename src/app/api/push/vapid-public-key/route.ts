import { NextResponse } from "next/server";

/** Public VAPID key for `PushManager.subscribe` (safe to expose). */
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!key) {
    return NextResponse.json({ error: "Web Push is not configured on the server." }, { status: 503 });
  }
  return NextResponse.json({ publicKey: key });
}
