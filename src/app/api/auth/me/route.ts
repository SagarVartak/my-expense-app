import { NextResponse } from "next/server";
import { getSessionUser, getSessionUserDebugInfo } from "@/lib/auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const debug =
    searchParams.get("debug") === "1" &&
    process.env.NODE_ENV === "development";

  const user = await getSessionUser();

  if (debug) {
    const debugInfo = await getSessionUserDebugInfo();
    return NextResponse.json({ user, debug: debugInfo });
  }

  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}

