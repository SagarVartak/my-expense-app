import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { getSessionUser } from "@/lib/auth";
import { generateEntryUid } from "@/lib/entryUid";
import { getServerSupabase } from "@/lib/serverSupabase";

type CsvRow = {
  date?: string;
  expense_date?: string;
  category?: string;
  description?: string;
  paidBy?: string;
  paid_by?: string;
  paymentMethod?: string;
  payment_method?: string;
  amount?: string;
};

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { csvText } = (await req.json()) as { csvText?: string };
    if (!csvText) return NextResponse.json({ error: "CSV content is required." }, { status: 400 });

    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
    }) as CsvRow[];

    const payload = records.map((r) => ({
      entry_uid: generateEntryUid(),
      expense_date: r.expense_date || r.date,
      category: r.category || "Other",
      description: r.description || "",
      paid_by: r.paid_by || r.paidBy || "Unknown",
      payment_method: r.payment_method || r.paymentMethod || "Other",
      amount: Number(r.amount || 0),
    }));

    const valid = payload.filter((r) => r.expense_date && r.amount > 0 && r.paid_by);
    if (valid.length === 0) {
      return NextResponse.json({ error: "No valid rows found in CSV." }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { error } = await supabase.from("expenses").insert(valid);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ inserted: valid.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

