import { randomBytes } from "crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Short human-friendly unique id for expenses, e.g. EXP-9K3FJ2A1 */
export function generateEntryUid(): string {
  const buf = randomBytes(10);
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += ALPHABET[buf[i]! % ALPHABET.length]!;
  }
  return `EXP-${s}`;
}

/** Order ledger public id, e.g. ORD-9K3FJ2A1 */
export function generateOrderUid(): string {
  const buf = randomBytes(10);
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += ALPHABET[buf[i]! % ALPHABET.length]!;
  }
  return `ORD-${s}`;
}

export function normalizeEntryUid(raw: string): string {
  return raw.trim().toUpperCase();
}
