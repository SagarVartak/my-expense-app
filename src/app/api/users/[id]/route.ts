import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await getSessionUser();
  if (!current || current.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const active = Boolean(body.active);

  const supabase = getServerSupabase();
  const { data: existing, error: findError } = await supabase.from("app_users").select("username").eq("id", id).single();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (existing.username === "admin" && !active) {
    return NextResponse.json({ error: "Cannot disable the default admin user." }, { status: 400 });
  }
  if (existing.username === current.username && !active) {
    return NextResponse.json({ error: "You cannot disable your own user." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("app_users")
    .update({ active })
    .eq("id", id)
    .select("id, username, role, active, created_at, email, email_verified_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data });
}

