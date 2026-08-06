import { NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/auditLog";
import { getSessionUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = getServerSupabase();

    const { data: designs, error: dErr } = await supabase
      .from("cost_designs")
      .select("id, keychain_design")
      .order("keychain_design", { ascending: true });
    if (dErr) return NextResponse.json({ error: dErr.message }, { status: 500 });

    const { data: agg, error: aErr } = await supabase.from("printed_inventory_entries").select("cost_design_id, quantity, printer_name, created_at");
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });

    const byDesign = new Map<
      string,
      { total: number; lastAt: string | null; lastPrinter: string | null }
    >();

    for (const row of agg ?? []) {
      const id = String((row as { cost_design_id: string }).cost_design_id);
      const q = Number((row as { quantity: number }).quantity) || 0;
      const at = String((row as { created_at: string }).created_at);
      const printer = String((row as { printer_name?: string }).printer_name ?? "").trim();
      const cur = byDesign.get(id) ?? { total: 0, lastAt: null, lastPrinter: null };
      cur.total += q;
      if (!cur.lastAt || at > cur.lastAt) {
        cur.lastAt = at;
        cur.lastPrinter = printer || null;
      }
      byDesign.set(id, cur);
    }

    const rows = (designs ?? []).map((d) => {
      const id = String((d as { id: string }).id);
      const name = String((d as { keychain_design: string }).keychain_design);
      const s = byDesign.get(id);
      return {
        cost_design_id: id,
        keychain_design: name,
        total_printed: s?.total ?? 0,
        last_print_at: s?.lastAt ?? null,
        last_printer_name: s?.lastPrinter ?? null,
      };
    });

    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const cost_design_id = String(body.cost_design_id ?? "").trim();
    const quantity = Math.floor(Number(body.quantity));
    const printer_name = String(body.printer_name ?? "").trim();

    if (!cost_design_id) {
      return NextResponse.json({ error: "cost_design_id is required." }, { status: 400 });
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      return NextResponse.json({ error: "quantity must be a positive integer." }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data: design, error: fErr } = await supabase
      .from("cost_designs")
      .select("id, keychain_design")
      .eq("id", cost_design_id)
      .maybeSingle();
    if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });
    if (!design) return NextResponse.json({ error: "Design not found." }, { status: 404 });

    const { data: entry, error: iErr } = await supabase
      .from("printed_inventory_entries")
      .insert({
        cost_design_id,
        quantity,
        printer_name,
        created_by: user.username,
      })
      .select("*")
      .single();
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

    const label = String((design as { keychain_design: string }).keychain_design).trim() || "(design)";
    const printerNote = printer_name ? ` · ${printer_name}` : "";
    await insertAuditLog(
      user.username,
      "LOG_PRINT_RUN",
      `Printed ${quantity} × "${label}"${printerNote}`,
    );

    return NextResponse.json({ entry });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "manager"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden: admin or manager required" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const cost_design_id = searchParams.get("cost_design_id");
    if (!cost_design_id) {
      return NextResponse.json({ error: "cost_design_id is required" }, { status: 400 });
    }

    const supabase = getServerSupabase();
    
    // Get design name for audit log
    const { data: design } = await supabase
      .from("cost_designs")
      .select("keychain_design")
      .eq("id", cost_design_id)
      .maybeSingle();

    const { data: entries, error: fetchErr } = await supabase
      .from("printed_inventory_entries")
      .select("id, quantity")
      .eq("cost_design_id", cost_design_id);

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

    const totalQty = (entries ?? []).reduce((sum, e) => sum + (e.quantity || 0), 0);

    const { error: delErr } = await supabase
      .from("printed_inventory_entries")
      .delete()
      .eq("cost_design_id", cost_design_id);

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    const label = design?.keychain_design || cost_design_id;
    await insertAuditLog(
      user.username,
      "DELETE_PRINT_INVENTORY",
      `Deleted all inventory entries for "${label}" (${entries?.length || 0} entries, total ${totalQty} units)`,
    );

    return NextResponse.json({ ok: true, deletedEntries: entries?.length || 0, totalQty });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["admin", "manager"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden: admin or manager required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const entryId = String(body.entry_id ?? "").trim();
    const quantity = body.quantity !== undefined ? Math.floor(Number(body.quantity)) : undefined;
    const printer_name = body.printer_name !== undefined ? String(body.printer_name ?? "").trim() : undefined;

    if (!entryId) {
      return NextResponse.json({ error: "entry_id is required" }, { status: 400 });
    }
    if (quantity === undefined && printer_name === undefined) {
      return NextResponse.json({ error: "quantity or printer_name is required" }, { status: 400 });
    }
    if (quantity !== undefined && (!Number.isFinite(quantity) || quantity === 0)) {
      return NextResponse.json({ error: "quantity must be a non-zero integer" }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const { data: existing, error: fetchErr } = await supabase
      .from("printed_inventory_entries")
      .select("id, cost_design_id, quantity, printer_name, created_by")
      .eq("id", entryId)
      .maybeSingle();

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    const updates: Record<string, unknown> = {};
    if (quantity !== undefined) updates.quantity = quantity;
    if (printer_name !== undefined) updates.printer_name = printer_name;

    const { data: updated, error: updErr } = await supabase
      .from("printed_inventory_entries")
      .update(updates)
      .eq("id", entryId)
      .select("*")
      .single();

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    const { data: design } = await supabase
      .from("cost_designs")
      .select("keychain_design")
      .eq("id", existing.cost_design_id)
      .maybeSingle();

    const label = design?.keychain_design || existing.cost_design_id;
    const changes: string[] = [];
    if (quantity !== undefined && quantity !== existing.quantity) {
      changes.push(`quantity: ${existing.quantity} → ${quantity}`);
    }
    if (printer_name !== undefined && printer_name !== existing.printer_name) {
      changes.push(`printer: "${existing.printer_name}" → "${printer_name}"`);
    }
    if (changes.length > 0) {
      await insertAuditLog(
        user.username,
        "UPDATE_PRINT_INVENTORY",
        `Updated inventory for "${label}" (${changes.join(", ")})`,
      );
    }

    return NextResponse.json({ entry: updated });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}