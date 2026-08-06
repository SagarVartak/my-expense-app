import { NextResponse } from "next/server";
import { insertAuditLog } from "@/lib/auditLog";
import { getSessionUser } from "@/lib/auth";
import { computeTotalCostPrice, num } from "@/lib/costDesignCalc";
import { notifyDiscordCostDesignSaved } from "@/lib/discordWebhook";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase.from("cost_designs").select("*").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ designs: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const keychain_design = String(body.keychain_design ?? "").trim();
    if (!keychain_design) {
      return NextResponse.json({ error: "Keychain design name is required." }, { status: 400 });
    }

    const print_weight_g = num(body.print_weight_g);
    const filament_cost_per_g = num(body.filament_cost_per_g);
    const electricity_fee = num(body.electricity_fee);
    const chain_cost = num(body.chain_cost);
    const pouch_cost = num(body.pouch_cost);
    const card_cost = num(body.card_cost);
    const primer_cost = num(body.primer_cost);
    const clearcoat_cost = num(body.clearcoat_cost);
    const key_caps_cost = num(body.key_caps_cost);
    const colour_cost = num(body.colour_cost);
    const shipping = num(body.shipping);

    const total_cost_price = computeTotalCostPrice({
      print_weight_g,
      filament_cost_per_g,
      electricity_fee,
      chain_cost,
      pouch_cost,
      card_cost,
      primer_cost,
      clearcoat_cost,
      key_caps_cost,
      colour_cost,
      shipping,
    });

    const row = {
      created_by: user.username,
      keychain_design,
      print_weight_g,
      filament_cost_per_g,
      electricity_fee,
      chain_cost,
      pouch_cost,
      card_cost,
      primer_cost,
      clearcoat_cost,
      key_caps_cost,
      colour_cost,
      shipping,
      total_cost_price,
      selling_price: 0,
      net_profit: 0,
    };

    const supabase = getServerSupabase();
    const { data, error } = await supabase.from("cost_designs").insert(row).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const money = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "0.00");
    await insertAuditLog(
      user.username,
      "ADD_COST_DESIGN",
      `Saved cost design "${keychain_design}" (total ₹${money(total_cost_price)})`,
    );

    if (data) {
      notifyDiscordCostDesignSaved(
        {
          keychain_design: data.keychain_design as string,
          print_weight_g: Number(data.print_weight_g),
          filament_cost_per_g: Number(data.filament_cost_per_g),
          electricity_fee: Number(data.electricity_fee),
          chain_cost: Number(data.chain_cost),
          pouch_cost: Number(data.pouch_cost),
          card_cost: Number(data.card_cost),
          primer_cost: Number(data.primer_cost),
          clearcoat_cost: Number(data.clearcoat_cost),
          key_caps_cost: Number(data.key_caps_cost ?? 0),
          colour_cost: Number(data.colour_cost ?? 0),
          shipping: Number(data.shipping),
          total_cost_price: Number(data.total_cost_price),
          created_at: data.created_at as string | null | undefined,
        },
        user.username,
      );
    }

    return NextResponse.json({ design: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
