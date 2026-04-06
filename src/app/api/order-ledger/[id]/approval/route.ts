import { NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/auditLog";
import { getSessionUser } from "@/lib/auth";
import { notifyDiscordOrderLedgerAdded } from "@/lib/discordWebhook";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const body = await req.json();
    const action = String(body.action ?? "").trim();
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action must be approve or reject." }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: row, error: fetchErr } = await supabase.from("order_ledger").select("*").eq("id", id).maybeSingle();
    if (fetchErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const status = String((row as { approval_status?: string }).approval_status ?? "approved");
    if (status !== "pending") {
      return NextResponse.json({ error: "Only pending orders can be approved or rejected." }, { status: 400 });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";
    const { data: updated, error: updErr } = await supabase
      .from("order_ledger")
      .update({ approval_status: newStatus })
      .eq("id", id)
      .select("*")
      .single();

    if (updErr) {
      if (/approval_status|column|schema cache/i.test(updErr.message)) {
        return NextResponse.json(
          { error: "Run migration_order_ledger_approval.sql on your database (approval_status column missing)." },
          { status: 500 },
        );
      }
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
    const uid = String((row as { order_uid?: string }).order_uid ?? "");
    const cust = String((row as { customer_name?: string }).customer_name ?? "");

    if (action === "reject") {
      const reason = String(body.reject_reason ?? "").trim();
      await insertAuditLog(
        user.username,
        "REJECT_ORDER_LEDGER",
        `Rejected new order ${uid} — ${cust}${reason ? ` — ${reason}` : ""}`,
      );
      return NextResponse.json({ order: updated });
    }

    await insertAuditLog(
      user.username,
      "APPROVE_ORDER_LEDGER",
      `Approved new order ${uid} — ${cust} — net ₹${money(Number((row as { net_profit?: number }).net_profit))}`,
    );

    if (updated) {
      notifyDiscordOrderLedgerAdded(updated as Parameters<typeof notifyDiscordOrderLedgerAdded>[0], user.username);
    }

    return NextResponse.json({ order: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
