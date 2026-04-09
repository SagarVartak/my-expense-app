import { NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/auditLog";
import { getSessionUser } from "@/lib/auth";
import { appBaseUrl } from "@/lib/email";
import { notifyAdminsPendingApproval } from "@/lib/notifyAdmins";
import type { DeletionResourceType } from "@/lib/types";
import { getServerSupabase } from "@/lib/serverSupabase";

function isResourceType(s: string): s is DeletionResourceType {
  return s === "expense" || s === "cost_design" || s === "order_ledger";
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const url = new URL(req.url);
    const scopeParam = url.searchParams.get("scope")?.trim();
    if (scopeParam === "all" && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const scope = scopeParam || (user.role === "admin" ? "all" : "mine");

    const supabase = getServerSupabase();
    let q = supabase.from("deletion_requests").select("*").eq("status", "pending").order("created_at", { ascending: false });

    if (user.role !== "admin" || scope === "mine") {
      q = q.eq("requested_by", user.username);
    }

    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ requests: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const resource_type = String(body.resource_type ?? "").trim();
    const resource_id = String(body.resource_id ?? "").trim();
    if (!isResourceType(resource_type) || !resource_id) {
      return NextResponse.json({ error: "resource_type and resource_id are required." }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const { data: existing, error: exErr } = await supabase
      .from("deletion_requests")
      .select("id")
      .eq("resource_type", resource_type)
      .eq("resource_id", resource_id)
      .eq("status", "pending")
      .maybeSingle();
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
    if (existing) {
      return NextResponse.json({ error: "A deletion request is already pending for this item." }, { status: 409 });
    }

    let payload: Record<string, unknown>;

    if (resource_type === "expense") {
      if (user.role !== "admin") {
        return NextResponse.json({ error: "Only an admin can request expense deletion." }, { status: 403 });
      }
      const { data: row, error: fetchErr } = await supabase.from("expenses").select("*").eq("id", resource_id).maybeSingle();
      if (fetchErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
      payload = {
        title: "Expense",
        entry_uid: row.entry_uid,
        expense_date: row.expense_date,
        category: row.category,
        amount: row.amount,
        paid_by: row.paid_by,
        description: row.description,
      };
    } else if (resource_type === "cost_design") {
      const { data: row, error: fetchErr } = await supabase.from("cost_designs").select("*").eq("id", resource_id).maybeSingle();
      if (fetchErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (user.role !== "admin" && row.created_by !== user.username) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      payload = {
        title: "Cost design",
        keychain_design: row.keychain_design,
        total_cost_price: row.total_cost_price,
        created_by: row.created_by,
      };
    } else {
      const { data: row, error: fetchErr } = await supabase.from("order_ledger").select("*").eq("id", resource_id).maybeSingle();
      if (fetchErr || !row) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (user.role !== "admin" && row.created_by !== user.username) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      payload = {
        title: "Order",
        order_uid: row.order_uid,
        customer_name: row.customer_name,
        design_name: row.design_name,
        net_profit: row.net_profit,
        created_by: row.created_by,
        approval_status: row.approval_status ?? "approved",
      };
    }

    const { data: created, error: insErr } = await supabase
      .from("deletion_requests")
      .insert({
        resource_type,
        resource_id,
        requested_by: user.username,
        status: "pending",
        payload,
      })
      .select("*")
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    const label =
      resource_type === "expense"
        ? `Expense ${String((payload as { entry_uid?: string }).entry_uid ?? resource_id).slice(0, 12)}`
        : resource_type === "cost_design"
          ? `Design "${String(payload.keychain_design)}"`
          : `Order ${String(payload.order_uid)}`;

    await insertAuditLog(
      user.username,
      "SUBMIT_DELETION_REQUEST",
      `Deletion requested — ${label} (${resource_type} ${resource_id.slice(0, 8)}…)`,
    );

    if (user.role !== "admin") {
      const open = `${appBaseUrl()}/?nav=deletionApprovals`;
      void notifyAdminsPendingApproval({
        subject: `Deletion approval requested: ${label}`,
        htmlBody: `<p><strong>${user.username}</strong> requested deletion: ${label} (${resource_type}).</p><p><a href="${open}">Open Deletion approvals</a></p>`,
        openPath: "/?nav=deletionApprovals",
      }).catch(() => {});
    }

    return NextResponse.json({ request: created });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
