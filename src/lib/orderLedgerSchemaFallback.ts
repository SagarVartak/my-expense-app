import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST: "Could not find the 'column_name' column of 'table' in the schema cache" */
export function extractMissingColumnNameFromPostgrestError(err: unknown): string | null {
  const msg = String((err as { message?: string })?.message ?? "");
  const m = msg.match(/the '([^']+)' column of/i);
  return m?.[1] ?? null;
}

const INSERT_OPTIONAL_COLUMNS = new Set([
  "approval_status",
  "exclude_shipping_from_cost",
  "units",
  "customer_phone",
  "shipment_tracking",
  "deadline_date",
  "deadline_status",
]);
const UPDATE_OPTIONAL_COLUMNS = new Set([
  "exclude_shipping_from_cost",
  "units",
  "customer_phone",
  "shipment_tracking",
  "deadline_date",
  "deadline_status",
]);

function isDuplicateKeyError(err: unknown): boolean {
  const code = String((err as { code?: string })?.code ?? "");
  return (
    code === "23505" || Boolean(String((err as { message?: string })?.message ?? "").match?.(/duplicate|unique/i))
  );
}

type OrderInsertRow = Record<string, unknown>;

/**
 * Inserts into order_ledger, stripping optional columns one at a time when PostgREST
 * reports missing columns (migrations not applied or stale cache).
 */
export async function insertOrderLedgerWithSchemaFallback(
  supabase: SupabaseClient,
  row: OrderInsertRow,
  generateOrderUid: () => string,
): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
  let attempt: OrderInsertRow = { ...row };

  for (let i = 0; i < 12; i++) {
    const { data, error } = await supabase.from("order_ledger").insert(attempt).select("*").single();
    if (!error) return { data: data as Record<string, unknown>, error: null };

    if (isDuplicateKeyError(error)) {
      attempt = { ...attempt, order_uid: generateOrderUid() };
      continue;
    }

    const col = extractMissingColumnNameFromPostgrestError(error);
    if (col && col in attempt && INSERT_OPTIONAL_COLUMNS.has(col)) {
      const { [col]: _, ...rest } = attempt;
      attempt = rest;
      continue;
    }

    return { data: data as Record<string, unknown> | null, error };
  }

  return { data: null, error: new Error("insertOrderLedgerWithSchemaFallback: too many retries") };
}

export async function updateOrderLedgerWithSchemaFallback(
  supabase: SupabaseClient,
  orderId: string,
  payload: Record<string, unknown>,
): Promise<{ data: Record<string, unknown> | null; error: unknown }> {
  let attempt = { ...payload };

  for (let i = 0; i < 12; i++) {
    const { data, error } = await supabase.from("order_ledger").update(attempt).eq("id", orderId).select("*").single();
    if (!error) return { data: data as Record<string, unknown>, error: null };

    const col = extractMissingColumnNameFromPostgrestError(error);
    if (col && col in attempt && UPDATE_OPTIONAL_COLUMNS.has(col)) {
      const { [col]: _, ...rest } = attempt;
      attempt = rest;
      continue;
    }

    return { data: data as Record<string, unknown> | null, error };
  }

  return { data: null, error: new Error("updateOrderLedgerWithSchemaFallback: too many retries") };
}
