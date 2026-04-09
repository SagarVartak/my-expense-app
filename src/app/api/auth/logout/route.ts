import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { authCookieName } from "@/lib/auth";
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from "@/lib/supabase/publicEnv";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(authCookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  const url = getPublicSupabaseUrl();
  const anon = getPublicSupabaseAnonKey();
  if (url && anon) {
    const cookieStore = await cookies();
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    });
    await supabase.auth.signOut();
  }

  return res;
}
