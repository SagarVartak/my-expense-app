import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/serverSupabase";

/** Sum of `net_profit` for orders with approval_status = approved (or legacy rows with no status). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from("order_ledger").select("net_profit, approval_status");
    if (error) {
      if (/order_ledger|relation|does not exist/i.test(error.message)) {
        return NextResponse.json({ totalApprovedNetProfit: 0 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let total = 0;
    for (const row of data ?? []) {
      const st = String((row as { approval_status?: string }).approval_status ?? "approved");
      if (st !== "approved") continue;
      total += Number((row as { net_profit?: unknown }).net_profit ?? 0);
    }

    const { data: expRows, error: expErr } = await supabase.from("expenses").select("amount");
    if (expErr) {
      return NextResponse.json({ error: expErr.message }, { status: 500 });
    }
    const totalExpenses = (expRows ?? []).reduce((s, r) => s + Number((r as { amount?: unknown }).amount ?? 0), 0);

    return NextResponse.json({ totalApprovedNetProfit: total, totalExpenses });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
