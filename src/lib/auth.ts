import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import type { Role, SessionUser } from "@/lib/types";
import { getServerSupabase } from "@/lib/serverSupabase";

const SESSION_COOKIE = "expense_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

type ServerUser = {
  username: string;
  role: Role;
  active: boolean;
  password_hash: string;
  email?: string | null;
  email_verified_at?: string | null;
};

function getSecret() {
  return process.env.AUTH_SESSION_SECRET || "dev-only-secret-change-me";
}

function sign(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function encodeSession(user: SessionUser) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = Buffer.from(JSON.stringify({ ...user, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) return null;

  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser & { exp: number };
  if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
  return { username: decoded.username, role: decoded.role };
}

async function getUserRecord(username: string): Promise<ServerUser | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase.from("app_users").select("*").eq("username", username).maybeSingle();
  if (error || !data) return null;
  return data as ServerUser;
}

async function findUserByLogin(login: string): Promise<ServerUser | null> {
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

export async function authenticate(usernameOrEmail: string, password: string): Promise<SessionUser | null> {
  const user = await findUserByLogin(usernameOrEmail);
  if (!user || !user.active) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return { username: user.username, role: user.role };
}

export function sessionCookieValue(user: SessionUser) {
  return encodeSession(user);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const fromCookie = decodeSession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!fromCookie) return null;
  const user = await getUserRecord(fromCookie.username);
  if (!user || !user.active) return null;
  return { username: user.username, role: user.role };
}

export const authCookieName = SESSION_COOKIE;
export const authCookieMaxAge = SESSION_TTL_SECONDS;

