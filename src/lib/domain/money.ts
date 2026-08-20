import Decimal from "decimal.js";

/**
 * Money handling for the whole app.
 *
 * The API sends amounts as strings and this module is the only thing that turns
 * them into numbers. `parseFloat` is never used: an accounting interface that
 * loses cents is worthless, and the split validator below has to agree with the
 * backend's arithmetic to the cent or the user gets a 400 they cannot act on.
 */

/** Split parts must agree with the bank line to within this, per the backend. */
const SPLIT_TOLERANCE = new Decimal("0.01");

export function toDecimal(value: string | number | null | undefined): Decimal {
  if (value === null || value === undefined || value === "") return new Decimal(0);
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

export function isValidAmount(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const parsed = new Decimal(value);
    return parsed.isFinite();
  } catch {
    return false;
  }
}

/** `1090.5` becomes `1,090.50`. No currency symbol - the columns carry that. */
export function formatAmount(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const parts = toDecimal(value).toFixed(2).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

export function formatSGD(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const decimal = toDecimal(value);
  const sign = decimal.isNegative() ? "-" : "";
  return `${sign}S$${formatAmount(decimal.abs().toFixed(2))}`;
}

export type SplitBalance = {
  total: Decimal;
  target: Decimal;
  difference: Decimal;
  balanced: boolean;
};

/**
 * Checks a proposed split against the bank line.
 *
 * The backend rejects an unbalanced split with the arithmetic spelled out, and
 * malformed parts crash it outright, so the form runs this first and refuses to
 * submit until it comes back balanced. Every cent of a transaction has to be
 * accounted for.
 */
export function checkSplit(
  parts: { amount: string }[],
  bankLineAmount: string,
): SplitBalance {
  const total = parts.reduce((sum, part) => sum.plus(toDecimal(part.amount)), new Decimal(0));
  const target = toDecimal(bankLineAmount);
  const difference = total.minus(target);
  return {
    total,
    target,
    difference,
    balanced: difference.abs().lessThanOrEqualTo(SPLIT_TOLERANCE),
  };
}

/**
 * Which side of the statement a line sits on. `money_in` and `money_out` are
 * kept apart deliberately - never combined into a signed value.
 */
export function direction(transaction: {
  money_in: string | null;
  money_out: string | null;
}): "in" | "out" {
  return transaction.money_in ? "in" : "out";
}
