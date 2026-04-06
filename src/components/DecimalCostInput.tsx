"use client";

import type { InputHTMLAttributes } from "react";

/** Text + decimal keyboard: avoids browser quirks with controlled `type="number"` while typing. */
export default function DecimalCostInput({
  value,
  onValueChange,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (v: string) => void;
}) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    />
  );
}
