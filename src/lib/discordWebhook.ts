/**
 * Optional Discord notifications when DISCORD_WEBHOOK_URL is set (server-only).
 * @see https://discord.com/developers/docs/resources/webhook#execute-webhook
 */

type ExpenseRow = {
  id: string;
  entry_uid?: string | null;
  expense_date: string;
  category: string;
  amount: number;
  paid_by: string;
  payment_method: string;
  description?: string | null;
  created_at?: string | null;
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * Fire-and-forget: does not block the API response; logs errors to the server console.
 */
export function notifyDiscordExpenseAdded(expense: ExpenseRow, addedBy: string): void {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!url) return;

  const currency = process.env.DISCORD_CURRENCY_SYMBOL?.trim() || "₹";
  const amountStr = `${currency}${Number(expense.amount).toFixed(2)}`;
  const description = (expense.description ?? "").trim() || "—";
  const entryLabel = expense.entry_uid?.trim() || expense.id;

  const embed: Record<string, unknown> = {
    title: "New expense",
    color: 0x60adff,
    fields: [
      { name: "Entry ID", value: truncate(entryLabel, 1024), inline: true },
      { name: "Date", value: truncate(expense.expense_date, 1024), inline: true },
      { name: "Category", value: truncate(expense.category, 1024), inline: true },
      { name: "Amount", value: truncate(amountStr, 1024), inline: true },
      { name: "Paid by", value: truncate(expense.paid_by, 1024), inline: true },
      { name: "Payment method", value: truncate(expense.payment_method, 1024), inline: true },
      { name: "Added by", value: truncate(addedBy, 1024), inline: true },
      { name: "Description", value: truncate(description, 1024), inline: false },
    ],
    footer: { text: "Expense tracker" },
  };
  if (expense.created_at) {
    const d = new Date(expense.created_at);
    if (!Number.isNaN(d.getTime())) embed.timestamp = d.toISOString();
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] }),
  }).catch((err: unknown) => {
    console.error("[discord webhook] notify failed:", err);
  });
}
