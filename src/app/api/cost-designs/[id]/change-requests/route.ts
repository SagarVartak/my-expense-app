import { NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/auditLog";
import { getSessionUser } from "@/lib/auth";
import { snapshotFromDbRow, snapshotFromRequestBody } from "@/lib/costDesignSnapshots";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: costDesignId } = await params;
  if (!costDesignId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const body = await req.json();
    const proposed = snapshotFromRequestBody(body as Record<string, unknown>);
    if (!proposed.keychain_design) {
      return NextResponse.json({ error: "Keychain design name is required." }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: row, error: fetchErr } = await supabase.from("cost_designs").select("*").eq("id", costDesignId).maybeSingle();
    if (fetchErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: pending, error: pendErr } = await supabase
      .from("cost_design_change_requests")
      .select("id")
      .eq("cost_design_id", costDesignId)
      .eq("status", "pending")
      .maybeSingle();
    if (pendErr) return NextResponse.json({ error: pendErr.message }, { status: 500 });
    if (pending) {
      return NextResponse.json(
        { error: "A pending change request already exists for this design. Wait for an admin to review it." },
        { status: 409 },
      );
    }

    const previous_snapshot = snapshotFromDbRow(row as Record<string, unknown>);
    const proposed_snapshot = proposed;

    const { data: created, error: insErr } = await supabase
      .from("cost_design_change_requests")
      .insert({
        cost_design_id: costDesignId,
        status: "pending",
        requested_by: user.username,
        previous_snapshot,
        proposed_snapshot,
      })
      .select("*")
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
    await insertAuditLog(
      user.username,
      "SUBMIT_COST_DESIGN_CHANGE",
      `Request for design "${previous_snapshot.keychain_design}" — total ₹${money(previous_snapshot.total_cost_price)} → ₹${money(proposed_snapshot.total_cost_price)} (pending approval)`,
    );

    return NextResponse.json({ request: created });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
