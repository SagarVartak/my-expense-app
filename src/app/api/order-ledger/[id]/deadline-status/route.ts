import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/serverSupabase";
import { insertAuditLog } from "@/lib/auditLog";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const body = await req.json();
    const deadline_status = body.deadline_status as string;

    const validStatuses = ["not_started", "print_started", "print_done", "in_transit", "delivered", "cancelled"];
    if (!validStatuses.includes(deadline_status)) {
      return NextResponse.json({ error: "Invalid deadline status" }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const { data: order, error: fetchErr } = await supabase
      .from("order_ledger")
      .select("id, order_uid, customer_name, deadline_status")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { error } = await supabase
      .from("order_ledger")
      .update({ deadline_status })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await insertAuditLog(
      user.username,
      "UPDATE_ORDER_DEADLINE_STATUS",
      `Order ${order.order_uid} — ${order.customer_name} — deadline status: ${order.deadline_status} → ${deadline_status}`,
    );

    return NextResponse.json({ ok: true, deadline_status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}