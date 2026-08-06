import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import type { Role, SessionUser } from "@/lib/types";
import { getServerSupabase } from "@/lib/serverSupabase";
import { getPublicSupabaseUrl, isSupabaseAuthEnvConfigured } from "@/lib/supabase/publicEnv";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SESSION_COOKIE = "expense_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

type ServerUser = {
  id: string;
  username: string;
  role: Role;
  active: boolean;
  password_hash: string;
  email?: string | null;
  email_verified_at?: string | null;
  auth_user_id?: string | null;
};

function getSecret() {
  return process.env.AUTH_SESSION_SECRET || "dev-only-secret-change-me";
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function encodeSession(user: { username: string; role: Role }) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ username: user.username, role: user.role, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token: string | undefined): Omit<SessionUser, "authMethod"> | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    username: string;
    role: Role;
    exp: number;
  };
  if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
  return { username: decoded.username, role: decoded.role };
}

async function getUserRecord(username: string): Promise<ServerUser | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("app_users").select("*").eq("username", username).maybeSingle();
  if (error || !data) return null;
  return data as ServerUser;
}

export async function findUserByLogin(login: string): Promise<ServerUser | null> {
  const q = login.trim().toLowerCase();
  if (!q) return null;
  const supabase = getServerSupabase();

  const { data: byUser, error: errUser } = await supabase.from("app_users").select("*").eq("username", q).maybeSingle();
  if (errUser) return null;
  if (byUser) return byUser as ServerUser;

  if (q.includes("@")) {
    const { data: byEmail, error: errEmail } = await supabase.from("app_users").select("*").eq("email", q).maybeSingle();
    if (errEmail || !byEmail) return null;
    const u = byEmail as ServerUser;
    if (u.email && !u.email_verified_at) return null;
    return u;
  }

  return null;
}

async function findAppUserForSupabaseAuth(
  authUserId: string,
  email: string,
): Promise<ServerUser | null> {
  const supabase = getServerSupabase();
  const { data: byAuth } = await supabase.from("app_users").select("*").eq("auth_user_id", authUserId).maybeSingle();
  if (byAuth) return byAuth as ServerUser;

  const { data: byEmail } = await supabase.from("app_users").select("*").eq("email", email).maybeSingle();
  if (byEmail) return byEmail as ServerUser;

  return null;
}

export function sessionCookieValue(user: SessionUser) {
  return encodeSession({ username: user.username, role: user.role });
}

/** Resolves session from Supabase Google OAuth only (see `app_users` email + role). */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseAuthEnvConfigured()) {
    return null;
  }

  try {
    const supabaseAuth = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error,
    } = await supabaseAuth.auth.getUser();
    if (error || !authUser?.email) return null;

    const email = authUser.email.trim().toLowerCase();
    const appUser = await findAppUserForSupabaseAuth(authUser.id, email);
    if (!appUser || !appUser.active) return null;

    if (appUser.auth_user_id !== authUser.id) {
      const supabase = getServerSupabase();
      await supabase.from("app_users").update({ auth_user_id: authUser.id }).eq("id", appUser.id);
    }

    const avatar_url = authUser.user_metadata?.avatar_url ?? authUser.user_metadata?.picture ?? null;

    return { username: appUser.username, role: appUser.role, authMethod: "google", avatar_url };
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getSessionUser] Supabase path failed:", e);
    }
    return null;
  }
}

/**
 * Dev-only diagnostics for `/api/auth/me?debug=1` — explains why Google OAuth may not map to an app session.
 */
export async function getSessionUserDebugInfo(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const cookieStore = await cookies();
  out.hasLegacyCookie = Boolean(cookieStore.get(SESSION_COOKIE)?.value);
  const sbCookieNames = cookieStore
    .getAll()
    .map((c) => c.name)
    .filter((n) => n.startsWith("sb-") && n.includes("auth-token"));
  out.supabaseCookiePrefixes = sbCookieNames;
  const envUrl = getPublicSupabaseUrl();
  out.envSupabaseHost = envUrl?.replace(/^https?:\/\//, "").split("/")[0] ?? null;
  const cookieRef = sbCookieNames[0];
  const m = typeof cookieRef === "string" ? cookieRef.match(/^sb-([^-]+)-auth-token/) : null;
  out.cookieProjectRef = m?.[1] ?? null;
  const envRef = envUrl?.match(/^https?:\/\/([^.]+)\.supabase\.co/i)?.[1] ?? null;
  out.envProjectRef = envRef ?? null;
  out.projectRefMatch =
    out.cookieProjectRef && out.envProjectRef ? out.cookieProjectRef === out.envProjectRef : null;
  out.supabaseEnvConfigured = isSupabaseAuthEnvConfigured();

  if (!out.supabaseEnvConfigured) {
    out.reason =
      "missing_env: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY)";
    return out;
  }

  try {
    const supabaseAuth = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error,
    } = await supabaseAuth.auth.getUser();
    out.getUserError = error?.message ?? null;
    out.authUserId = authUser?.id ?? null;
    out.authEmail = authUser?.email ?? null;

    if (error) {
      out.reason = "supabase_get_user_failed";
      return out;
    }
    if (!authUser?.email) {
      out.reason = "no_email_on_supabase_user";
      return out;
    }

    const email = authUser.email.trim().toLowerCase();
    const appUser = await findAppUserForSupabaseAuth(authUser.id, email);
    out.appUserFound = Boolean(appUser);
    if (appUser) {
      out.appUsername = appUser.username;
      out.appRole = appUser.role;
      out.appUserActive = appUser.active;
    }

    if (!appUser) {
      out.reason = "no_app_users_row: add this email to app_users (or accept invite) so it matches Google";
      return out;
    }
    if (!appUser.active) {
      out.reason = "app_user_inactive";
      return out;
    }
    out.reason = "ok_should_have_session";
    return out;
  } catch (e) {
    out.reason = "exception";
    out.exception = (e as Error).message;
    return out;
  }
}

export const authCookieName = SESSION_COOKIE;
export const authCookieMaxAge = SESSION_TTL_SECONDS;

export const sessionCookieOptions = () =>
  ({
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
