/** Parse numeric fields from API / JSON bodies. */
export function num(v: unknown, def = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : def;
}

export function computeTotalCostPrice(input: {
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
}): number {
  const filamentLine = input.print_weight_g * input.filament_cost_per_g;
  return (
    filamentLine +
    input.electricity_fee +
    input.chain_cost +
    input.pouch_cost +
    input.card_cost +
    input.primer_cost +
    input.clearcoat_cost +
    input.key_caps_cost +
    input.colour_cost +
    input.shipping
  );
}
