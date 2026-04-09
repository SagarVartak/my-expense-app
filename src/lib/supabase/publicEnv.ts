/**
 * Public Supabase URL + anon key for browser and cookie-based auth.
 * The anon key may be set as either name (same value from Supabase → Project Settings → API).
 */
export function getPublicSupabaseUrl(): string | undefined {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return typeof u === "string" && u.trim() !== "" ? u.trim() : undefined;
}

export function getPublicSupabaseAnonKey(): string | undefined {
  const a = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (typeof a === "string" && a.trim() !== "") return a.trim();
  const b = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (typeof b === "string" && b.trim() !== "") return b.trim();
  return undefined;
}

export function isSupabaseAuthEnvConfigured(): boolean {
  return Boolean(getPublicSupabaseUrl() && getPublicSupabaseAnonKey());
}
