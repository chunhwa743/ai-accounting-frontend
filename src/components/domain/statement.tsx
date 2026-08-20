"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BankTransaction, FieldLegibility } from "@/lib/api/types";
import { formatAmount } from "@/lib/domain/money";
import { legibilityNote, reconcilesLabel } from "@/lib/domain/vocabulary";
import { cn } from "@/lib/utils";
import { WarningHint } from "./badges";

/**
 * Money in and money out as two columns, the way a statement prints them.
 *
 * They are never combined into a signed value. A bank statement is written from
 * the bank's point of view, which is the mirror of the client's, and inferring
 * the sign is exactly where errors creep in.
 */
export function MoneyCells({
  transaction,
  className,
}: {
  transaction: Pick<BankTransaction, "money_in" | "money_out">;
  className?: string;
}) {
  return (
    <>
      <td className={cn("px-3 py-2 text-right font-mono text-sm tabular-nums", className)}>
        {transaction.money_in ? formatAmount(transaction.money_in) : null}
      </td>
      <td className={cn("px-3 py-2 text-right font-mono text-sm tabular-nums", className)}>
        {transaction.money_out ? formatAmount(transaction.money_out) : null}
      </td>
    </>
  );
}

/** The same pair outside a table, for the detail panel. */
export function MoneyPair({
  transaction,
}: {
  transaction: Pick<BankTransaction, "money_in" | "money_out">;
}) {
  return (
    <div className="flex gap-6">
      <div>
        <div className="text-muted-foreground text-xs">Money in</div>
        <div className="font-mono text-sm tabular-nums">
          {transaction.money_in ? formatAmount(transaction.money_in) : "—"}
        </div>
      </div>
      <div>
        <div className="text-muted-foreground text-xs">Money out</div>
        <div className="font-mono text-sm tabular-nums">
          {transaction.money_out ? formatAmount(transaction.money_out) : "—"}
        </div>
      </div>
    </div>
  );
}

/**
 * Flags a field the model could not read cleanly off the page.
 *
 * Usually there is nothing to show: `field_legibility` only carries the fields
 * that were *not* clear. When it does carry something, it is a cue to glance at
 * the source document rather than trust the text.
 */
export function LegibilityWarning({ legibility }: { legibility: FieldLegibility }) {
  const entries = Object.entries(legibility).filter(([, level]) => level !== "clear");
  if (entries.length === 0) return null;

  return (
    <WarningHint>
      <div className="space-y-1">
        {entries.map(([field, level]) => (
          <div key={field}>{legibilityNote(field, level)}</div>
        ))}
      </div>
    </WarningHint>
  );
}

/**
 * Whether a statement's own arithmetic verified.
 *
 * Three-state on purpose. `null` means the check could not run because the file
 * printed no balances - it is rendered as "not verified", never as a tick. A CSV
 * export with no balance column is unverifiable, not fine.
 */
export function ReconcilesBadge({ reconciles }: { reconciles: boolean | null }) {
  const meta = reconcilesLabel(reconciles);
  const tone =
    meta.tone === "ok"
      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      : meta.tone === "bad"
        ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200"
        : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className={tone}>
          {meta.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{meta.explanation}</TooltipContent>
    </Tooltip>
  );
}

/**
 * `null` account is not an error - it means the system genuinely could not tell.
 * The API returns 400 if you try to approve one, because "we do not know" is not
 * something anyone can sign off.
 */
export function AccountLabel({
  code,
  name,
  className,
}: {
  code: string | null;
  name: string | null;
  className?: string;
}) {
  if (!code) {
    return (
      <span className={cn("text-amber-700 dark:text-amber-400", className)}>Unresolved</span>
    );
  }
  return (
    <span className={cn("flex items-baseline gap-1.5", className)}>
      <span className="font-mono text-xs tabular-nums">{code}</span>
      <span className="truncate">{name}</span>
    </span>
  );
}
