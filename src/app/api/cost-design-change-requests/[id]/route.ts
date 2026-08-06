import { NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/auditLog";
import { getSessionUser } from "@/lib/auth";
import { snapshotFromRequestBody, snapshotToUpdateRow } from "@/lib/costDesignSnapshots";
import { notifyDiscordCostDesignSaved } from "@/lib/discordWebhook";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    const { data: reqRow, error: fetchErr } = await supabase
      .from("cost_design_change_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (fetchErr || !reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (reqRow.status !== "pending") {
      return NextResponse.json({ error: "This request is no longer pending." }, { status: 400 });
    }

    const costDesignId = reqRow.cost_design_id as string;
    const previous_snapshot = reqRow.previous_snapshot as Record<string, unknown>;
    const proposed_payload = reqRow.proposed_snapshot as Record<string, unknown>;

    if (action === "reject") {
      const reject_reason = String(body.reject_reason ?? "").trim();
      const { error: updErr } = await supabase
        .from("cost_design_change_requests")
        .update({
          status: "rejected",
          reviewed_by: user.username,
          reviewed_at: new Date().toISOString(),
          reject_reason: reject_reason,
        })
        .eq("id", id);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

      const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
      const prev = Number(previous_snapshot.total_cost_price ?? 0);
      const prop = Number(proposed_payload.total_cost_price ?? 0);
      await insertAuditLog(
        user.username,
        "REJECT_COST_DESIGN_CHANGE",
        `Rejected change request ${id.slice(0, 8)}… for design "${String(proposed_payload.keychain_design ?? "")}" (₹${money(prev)} → ₹${money(prop)} was proposed)${reject_reason ? ` — ${reject_reason}` : ""}`,
      );

      return NextResponse.json({ ok: true });
    }

    // approve: recompute from proposed JSON (do not trust stored total alone)
    const proposed = snapshotFromRequestBody(proposed_payload);
    const { data: design, error: designErr } = await supabase.from("cost_designs").select("id").eq("id", costDesignId).maybeSingle();
    if (designErr || !design) return NextResponse.json({ error: "Design no longer exists." }, { status: 404 });

    const { data: updated, error: applyErr } = await supabase
      .from("cost_designs")
      .update(snapshotToUpdateRow(proposed))
      .eq("id", costDesignId)
      .select("*")
      .single();
    if (applyErr) return NextResponse.json({ error: applyErr.message }, { status: 500 });

    const { error: reqUpdErr } = await supabase
      .from("cost_design_change_requests")
      .update({
        status: "approved",
        reviewed_by: user.username,
        reviewed_at: new Date().toISOString(),
        reject_reason: "",
      })
      .eq("id", id);
    if (reqUpdErr) return NextResponse.json({ error: reqUpdErr.message }, { status: 500 });

    const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
    const prev = snapshotFromRequestBody(previous_snapshot);
    await insertAuditLog(
      user.username,
      "APPROVE_COST_DESIGN_CHANGE",
      `Approved change request for "${proposed.keychain_design}" (requested by ${String(reqRow.requested_by)}) — total ₹${money(prev.total_cost_price)} → ₹${money(proposed.total_cost_price)}`,
    );

    if (updated) {
      notifyDiscordCostDesignSaved(
        {
          keychain_design: updated.keychain_design as string,
          print_weight_g: Number(updated.print_weight_g),
          filament_cost_per_g: Number(updated.filament_cost_per_g),
          electricity_fee: Number(updated.electricity_fee),
          chain_cost: Number(updated.chain_cost),
          pouch_cost: Number(updated.pouch_cost),
          card_cost: Number(updated.card_cost),
          primer_cost: Number(updated.primer_cost),
          clearcoat_cost: Number(updated.clearcoat_cost),
          key_caps_cost: Number(updated.key_caps_cost ?? 0),
          colour_cost: Number((updated as Record<string, unknown>).colour_cost ?? 0),
          shipping: Number(updated.shipping),
          total_cost_price: Number(updated.total_cost_price),
          created_at: updated.created_at as string | null | undefined,
        },
        user.username,
        { variant: "update" },
      );
    }

    return NextResponse.json({ design: updated, requestId: id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
