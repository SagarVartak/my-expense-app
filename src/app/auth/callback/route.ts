import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from "@/lib/supabase/publicEnv";

/**
 * OAuth redirect target for Google. Configure the same URL in Supabase Dashboard
 * → Authentication → URL Configuration → Redirect URLs: https://your-domain/auth/callback
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const url = getPublicSupabaseUrl();
  const anon = getPublicSupabaseAnonKey();
  if (!url || !anon) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const redirectTo = `${origin}${next.startsWith("/") ? next : `/${next}`}`;
  const response = NextResponse.redirect(redirectTo);

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  return response;
}
