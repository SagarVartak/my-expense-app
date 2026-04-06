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
