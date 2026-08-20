"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";

import { AccountPicker } from "@/components/domain/account-picker";
import { Spinner } from "@/components/domain/states";
import { TaxCodePicker } from "@/components/domain/tax-code-picker";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Account, ReviewItem } from "@/lib/api/types";
import { formatAmount } from "@/lib/domain/money";
import { RuleToggle } from "./rule-toggle";
import { useReview } from "./use-review";

/**
 * Corrects a coding.
 *
 * The account comes from the chart of accounts and cannot be typed freehand. The
 * tax code is optional: left alone, the backend takes the account's own default,
 * which is right almost always.
 */
export function CorrectDialog({
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

  const [account, setAccount] = useState<Account | null>(null);
  const [taxCode, setTaxCode] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [createRule, setCreateRule] = useState(false);

  function reset() {
    setAccount(null);
    setTaxCode(null);
    setNote("");
    setCreateRule(false);
  }

  async function save() {
    if (!account) return;
    const result = await submit(allocation.id, {
      action: "override",
      account_code: account.code,
      ...(taxCode ? { tax_code: taxCode } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      create_rule: createRule,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Correct this coding</DialogTitle>
          <DialogDescription className="space-y-1">
            <span className="block font-mono text-xs">{transaction.raw_description}</span>
            <span className="block">
              {transaction.money_in ? "Money in" : "Money out"}{" "}
              {formatAmount(allocation.amount)}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-account`}>Account</Label>
            <AccountPicker value={account?.code ?? null} onChange={setAccount} />
            <p className="text-muted-foreground text-xs">
              {allocation.account_id
                ? `Currently ${allocation.account_id} ${allocation.account_name ?? ""}`
                : "Currently unresolved."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-tax`}>Tax code</Label>
            <TaxCodePicker
              value={taxCode}
              onChange={setTaxCode}
              placeholder={
                account
                  ? `Default for this account: ${account.default_tax_code}`
                  : "Use the account's default"
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-note`}>Note (optional)</Label>
            <Textarea
              id={`${fieldId}-note`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="e.g. invoice shows a laptop"
              rows={2}
            />
            {note.trim() ? (
              <Alert>
                <Info />
                <AlertDescription>
                  {/* apply_override writes the note into `reasoning`, replacing
                      what the model recorded. Say so rather than let it vanish. */}
                  A note replaces the model&rsquo;s recorded reasoning on this line. Leave it
                  empty to keep the original.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>

          <RuleToggle
            id={`${fieldId}-rule`}
            checked={createRule}
            onChange={setCreateRule}
            disabled={isPending}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!account || isPending}>
            {isPending ? <Spinner /> : null}
            Save correction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
