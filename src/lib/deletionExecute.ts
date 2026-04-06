import type { DeletionResourceType } from "@/lib/types";
import { getServerSupabase } from "@/lib/serverSupabase";

export async function executeResourceDelete(
  resourceType: DeletionResourceType,
  resourceId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getServerSupabase();
  const table =
    resourceType === "expense"
      ? "expenses"
      : resourceType === "cost_design"
        ? "cost_designs"
        : "order_ledger";
  const { error } = await supabase.from(table).delete().eq("id", resourceId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
