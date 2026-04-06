export function fmtCurrency(currencySymbol: string, n: number) {
  return `${currencySymbol}${Number(n).toFixed(2)}`;
}
