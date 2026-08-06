import { computeTotalCostPrice, num } from "@/lib/costDesignCalc";

/** Stored in change requests for audit / diff. */
export type CostDesignSnapshot = {
  keychain_design: string;
  print_weight_g: number;
  filament_cost_per_g: number;
  electricity_fee: number;
  chain_cost: number;
  pouch_cost: number;
  card_cost: number;
  primer_cost: number;
  clearcoat_cost: number;
  key_caps_cost: number;
  colour_cost: number;
  shipping: number;
  total_cost_price: number;
};

export function snapshotFromDbRow(row: Record<string, unknown>): CostDesignSnapshot {
  const print_weight_g = num(row.print_weight_g);
  const filament_cost_per_g = num(row.filament_cost_per_g);
  const electricity_fee = num(row.electricity_fee);
  const chain_cost = num(row.chain_cost);
  const pouch_cost = num(row.pouch_cost);
  const card_cost = num(row.card_cost);
  const primer_cost = num(row.primer_cost);
  const clearcoat_cost = num(row.clearcoat_cost);
  const key_caps_cost = num(row.key_caps_cost);
  const colour_cost = num(row.colour_cost);
  const shipping = num(row.shipping);
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
  return {
    keychain_design: String(row.keychain_design ?? "").trim(),
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
  };
}

export function snapshotFromRequestBody(body: Record<string, unknown>): CostDesignSnapshot {
  const keychain_design = String(body.keychain_design ?? "").trim();
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
  return {
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
  };
}

export function snapshotToUpdateRow(s: CostDesignSnapshot) {
  return {
    keychain_design: s.keychain_design,
    print_weight_g: s.print_weight_g,
    filament_cost_per_g: s.filament_cost_per_g,
    electricity_fee: s.electricity_fee,
    chain_cost: s.chain_cost,
    pouch_cost: s.pouch_cost,
    card_cost: s.card_cost,
    primer_cost: s.primer_cost,
    clearcoat_cost: s.clearcoat_cost,
    key_caps_cost: s.key_caps_cost,
    colour_cost: s.colour_cost,
    shipping: s.shipping,
    total_cost_price: s.total_cost_price,
  };
}
