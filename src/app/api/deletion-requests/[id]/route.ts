import { NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/auditLog";
import { getSessionUser } from "@/lib/auth";
import { executeResourceDelete } from "@/lib/deletionExecute";
import type { DeletionResourceType } from "@/lib/types";
import { getServerSupabase } from "@/lib/serverSupabase";

function isResourceType(s: string): s is DeletionResourceType {
  return s === "expense" || s === "cost_design" || s === "order_ledger";
}

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
    const { data: row, error: fetchErr } = await supabase.from("deletion_requests").select("*").eq("id", id).maybeSingle();
    if (fetchErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (row.status !== "pending") {
      return NextResponse.json({ error: "This request is no longer pending." }, { status: 400 });
    }

    const resource_type = String(row.resource_type);
    const resource_id = String(row.resource_id);
    if (!isResourceType(resource_type)) {
      return NextResponse.json({ error: "Invalid resource type." }, { status: 500 });
    }

    const payload = row.payload as Record<string, unknown>;

    if (action === "reject") {
      const reject_reason = String(body.reject_reason ?? "").trim();
      const { error: updErr } = await supabase
        .from("deletion_requests")
        .update({
          status: "rejected",
          reviewed_by: user.username,
          reviewed_at: new Date().toISOString(),
          reject_reason,
        })
        .eq("id", id);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

      await insertAuditLog(
        user.username,
        "REJECT_DELETION_REQUEST",
        `Rejected deletion ${id.slice(0, 8)}… (${resource_type})${reject_reason ? ` — ${reject_reason}` : ""}`,
      );

      return NextResponse.json({ ok: true });
    }

    const del = await executeResourceDelete(resource_type, resource_id);
    if (!del.ok) {
      return NextResponse.json({ error: del.error || "Could not delete resource." }, { status: 500 });
    }

    const { error: reqUpdErr } = await supabase
      .from("deletion_requests")
      .update({
        status: "approved",
        reviewed_by: user.username,
        reviewed_at: new Date().toISOString(),
        reject_reason: "",
      })
      .eq("id", id);
    if (reqUpdErr) return NextResponse.json({ error: reqUpdErr.message }, { status: 500 });

    const label =
      resource_type === "expense"
        ? `Expense ${String(payload.entry_uid ?? resource_id)}`
        : resource_type === "cost_design"
          ? `Design "${String(payload.keychain_design ?? "")}"`
          : `Order ${String(payload.order_uid ?? "")}`;

    const auditAction =
      resource_type === "expense"
        ? "DELETE_EXPENSE"
        : resource_type === "cost_design"
          ? "DELETE_COST_DESIGN"
          : "DELETE_ORDER_LEDGER";

    const auditDetail =
      resource_type === "expense"
        ? `Approved deletion: ${label}`
        : resource_type === "cost_design"
          ? `Approved deletion: ${label} (requested by ${String(row.requested_by)})`
          : `Approved deletion: ${String(payload.order_uid)} — ${String(payload.customer_name ?? "")} — "${String(payload.design_name ?? "")}" (requested by ${String(row.requested_by)})`;

    await insertAuditLog(user.username, auditAction, auditDetail);

    return NextResponse.json({ ok: true, resource_type, resource_id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
