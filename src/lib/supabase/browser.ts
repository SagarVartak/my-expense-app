import { createBrowserClient } from "@supabase/ssr";
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from "@/lib/supabase/publicEnv";

export function createSupabaseBrowserClient() {
  const url = getPublicSupabaseUrl();
  const anon = getPublicSupabaseAnonKey();
  if (!url || !anon) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY).",
    );
  }
  return createBrowserClient(url, anon);
}
