import { NextResponse } from "next/server";

/** Password sign-in is disabled; all users (including admins) sign in with Google OAuth. */
export async function POST() {
  return NextResponse.json(
    { error: "Password sign-in is disabled. Use Continue with Google on the sign-in page." },
    { status: 403 },
  );
}
