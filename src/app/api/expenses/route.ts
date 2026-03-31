import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { generateEntryUid, normalizeEntryUid } from "@/lib/entryUid";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const paidBy = url.searchParams.get("paidBy");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");
    const entryUidRaw = url.searchParams.get("entryUid")?.trim();
    if (entryUidRaw) {
      if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const supabase = getServerSupabase();
    let query = supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (paidBy) query = query.eq("paid_by", paidBy);
    if (startDate) query = query.gte("expense_date", startDate);
    if (endDate) query = query.lte("expense_date", endDate);
    if (entryUidRaw) query = query.eq("entry_uid", normalizeEntryUid(entryUidRaw));

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ expenses: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const payload = {
      entry_uid: generateEntryUid(),
      expense_date: body.expense_date,
      category: body.category,
      amount: Number(body.amount),
      paid_by: body.paid_by,
      payment_method: body.payment_method,
      description: body.description || "",
    };
    const supabase = getServerSupabase();
    let { data, error } = await supabase.from("expenses").insert(payload).select("*").single();
    if (error) {
      const dup =
        (error as { code?: string }).code === "23505" ||
        Boolean(error.message && /duplicate|unique/i.test(error.message));
      if (dup) {
        const retry = await supabase
          .from("expenses")
          .insert({ ...payload, entry_uid: generateEntryUid() })
          .select("*")
          .single();
        data = retry.data;
        error = retry.error;
      }
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ expense: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

