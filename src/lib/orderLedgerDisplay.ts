export function fmtOrderMoney(currencySymbol: string, n: number) {
  return `${currencySymbol}${Number(n).toFixed(2)}`;
}

export function fmtOrderDate(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}
