"use client";

import { useId, useState } from "react";
import { Plus, X } from "lucide-react";

import { AccountPicker } from "@/components/domain/account-picker";
import { Spinner } from "@/components/domain/states";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Account, ReviewItem } from "@/lib/api/types";
import { checkSplit, formatAmount, isValidAmount } from "@/lib/domain/money";
import { cn } from "@/lib/utils";
import { useReview } from "./use-review";

type Part = { account: Account | null; amount: string };

/**
 * Splits one bank line across several accounts.
 *
 * A loan repayment is the usual case: one payment, part principal and part
 * interest, in a ratio that comes from the loan schedule and that no model can
 * know. The parts must sum to the bank line - every cent of a transaction has to
 * be accounted for - so the arithmetic is checked here before submitting, both
 * because the backend rejects an unbalanced split and because a malformed part
 * crashes it outright.
 */
export function SplitDialog({
  item,
  runId,
  clientId,
  open,
  onOpenChange,
}: {
  item: ReviewItem;
  runId: number;
  clientId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { allocation, transaction } = item;
  const { submit, isPending } = useReview(runId, clientId);
  const fieldId = useId();

  const [parts, setParts] = useState<Part[]>([
    { account: null, amount: "" },
    { account: null, amount: "" },
  ]);
  const [note, setNote] = useState("");

  const balance = checkSplit(
    parts.map((part) => ({ amount: part.amount })),
    allocation.amount,
  );
  const everyPartValid = parts.every(
    (part) => part.account !== null && isValidAmount(part.amount),
  );
  const canSave = everyPartValid && balance.balanced && parts.length >= 2 && !isPending;

  function update(index: number, patch: Partial<Part>) {
    setParts((current) =>
      current.map((part, i) => (i === index ? { ...part, ...patch } : part)),
    );
  }

  function reset() {
    setParts([
      { account: null, amount: "" },
      { account: null, amount: "" },
    ]);
    setNote("");
  }

  async function save() {
    if (!canSave) return;
    const result = await submit(allocation.id, {
      action: "split",
      parts: parts.map((part) => ({
        account_code: part.account!.code,
        amount: part.amount,
      })),
      ...(note.trim() ? { note: note.trim() } : {}),
    });
    if (result) {
      reset();
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Split across accounts</DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block font-mono text-xs">{transaction.raw_description}</span>
            <span className="block">
              The parts must add up to {formatAmount(allocation.amount)}.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {parts.map((part, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <AccountPicker
                  value={part.account?.code ?? null}
                  onChange={(account) => update(index, { account })}
                />
              </div>
              <div className="w-36">
                <Input
                  value={part.amount}
                  onChange={(event) => update(index, { amount: event.target.value })}
                  placeholder="0.00"
                  inputMode="decimal"
                  className={cn(
                    "text-right font-mono tabular-nums",
                    part.amount && !isValidAmount(part.amount) && "border-destructive",
                  )}
                  aria-label={`Amount for part ${index + 1}`}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 size-9"
                disabled={parts.length <= 2}
                onClick={() => setParts((current) => current.filter((_, i) => i !== index))}
                aria-label={`Remove part ${index + 1}`}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setParts((current) => [...current, { account: null, amount: "" }])}
          >
            <Plus className="size-4" />
            Add a part
          </Button>

          <div
            className={cn(
              "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
              balance.balanced
                ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
                : "border-amber-300 bg-amber-50 dark:bg-amber-950/40",
            )}
          >
            <span>Parts total</span>
            <span className="flex items-center gap-3 font-mono tabular-nums">
              <span>{formatAmount(balance.total.toFixed(2))}</span>
              <span className="text-muted-foreground">
                of {formatAmount(balance.target.toFixed(2))}
              </span>
              {balance.balanced ? (
                <span className="text-emerald-700 dark:text-emerald-400">balanced</span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400">
                  {balance.difference.isPositive() ? "over by " : "short by "}
                  {formatAmount(balance.difference.abs().toFixed(2))}
                </span>
              )}
            </span>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-note`}>Note (optional)</Label>
            <Textarea
              id={`${fieldId}-note`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. per the loan schedule"
              rows={2}
            />
          </div>

          <p className="text-muted-foreground text-xs">
            {/* review.split ignores create_rule entirely, so do not offer it. */}
            A split cannot be turned into a rule — the ratio comes from something outside the
            bank statement, so it has to be entered each time.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!canSave}>
            {isPending ? <Spinner /> : null}
            Save split
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
