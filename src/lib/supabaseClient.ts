import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl, isSupabaseAuthEnvConfigured } from "@/lib/supabase/publicEnv";

const supabaseUrl = getPublicSupabaseUrl();
const supabaseAnonKey = getPublicSupabaseAnonKey();

export const isSupabaseConfigured = isSupabaseAuthEnvConfigured();

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;
