"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { InfoHint } from "@/components/domain/badges";
import { EmptyState, ErrorState, LoadingRows, Spinner } from "@/components/domain/states";
import { AccountLabel } from "@/components/domain/statement";
import { TaxCodeLabel } from "@/components/domain/tax-code-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useClientRules, useDeleteRule } from "@/lib/api/queries";
import type { MerchantRule } from "@/lib/api/types";
import { formatRelative, pluralise } from "@/lib/domain/format";

/**
 * What the system has learned about this client.
 *
 * A rule applies every time until someone removes it, so this list is both the
 * record of what was taught and the place to unteach it. Rules are scoped to one
 * client on purpose: `GRAB` means travel for a design agency and a delivery cost
 * for a restaurant, and a rule learned for one must never reach the other.
 */
export function LearnedRules({ clientId }: { clientId: number }) {
  const { data: rules, isLoading, error } = useClientRules(clientId);
  const [pendingDelete, setPendingDelete] = useState<MerchantRule | null>(null);

  const active = rules?.filter((rule) => rule.is_active) ?? [];
  const retired = rules?.filter((rule) => !rule.is_active) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Learned rules</h2>
        <p className="text-muted-foreground text-sm">
          Patterns you have taught the system for this client. When one matches, the transaction
          is coded without the model being called at all.
        </p>
      </div>

      {error ? <ErrorState error={error} title="Could not load the rules" /> : null}
      {isLoading ? <LoadingRows rows={4} /> : null}

      {rules && rules.length === 0 ? (
        <EmptyState title="Nothing learned yet">
          Tick &ldquo;always code this merchant this way&rdquo; when you approve or correct a
          transaction, and the rule will appear here.
        </EmptyState>
      ) : null}

      {active.length > 0 ? (
        <RuleTable
          rules={active}
          caption={`${pluralise(active.length, "active rule")}, longest pattern first — that is the order they are matched in.`}
          onDelete={setPendingDelete}
        />
      ) : null}

      {retired.length > 0 ? (
        <RuleTable
          rules={retired}
          caption={`${pluralise(retired.length, "retired rule")}. These no longer match anything.`}
          muted
        />
      ) : null}

      <DeleteRuleDialog
        rule={pendingDelete}
        clientId={clientId}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

function RuleTable({
  rules,
  caption,
  muted,
  onDelete,
}: {
  rules: MerchantRule[];
  caption: string;
  muted?: boolean;
  onDelete?: (rule: MerchantRule) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">{caption}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th>Pattern</th>
              <th>Codes to</th>
              <th>Tax</th>
              <th className="text-right!">
                <span className="inline-flex items-center gap-1">
                  Confirmed
                  <InfoHint>
                    How many times an accountant has approved a result this rule produced. A rule
                    confirmed eight times is trustworthy in a way a day-old one is not.
                  </InfoHint>
                </span>
              </th>
              <th>Last used</th>
              {onDelete ? <th className="w-10" /> : null}
            </tr>
          </thead>
          <tbody className={muted ? "opacity-60" : undefined}>
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-muted/40 border-t">
                <td className="px-3 py-2">
                  <span className="font-mono text-xs">{rule.match_pattern}</span>
                  {rule.match_type !== "CONTAINS" ? (
                    <Badge variant="outline" className="ml-2">
                      {rule.match_type}
                    </Badge>
                  ) : null}
                </td>
                <td className="px-3 py-2">
                  <AccountLabel code={rule.account_id} name={rule.account_name} />
                </td>
                <td className="px-3 py-2">
                  <TaxCodeLabel code={rule.tax_code} />
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">
                  {rule.confirm_count}
                </td>
                <td className="text-muted-foreground px-3 py-2 text-xs">
                  {rule.last_applied_at ? formatRelative(rule.last_applied_at) : "never"}
                </td>
                {onDelete ? (
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => onDelete(rule)}
                      aria-label={`Remove the rule for ${rule.match_pattern}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeleteRuleDialog({
  rule,
  clientId,
  onClose,
}: {
  rule: MerchantRule | null;
  clientId: number;
  onClose: () => void;
}) {
  const deleteRule = useDeleteRule(clientId);

  async function confirm() {
    if (!rule) return;
    try {
      await deleteRule.mutateAsync(rule.id);
      toast.success(`The rule for "${rule.match_pattern}" will no longer be applied.`);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "the rule could not be removed",
      );
    }
  }

  return (
    <AlertDialog open={rule !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Stop applying this rule?</AlertDialogTitle>
          <AlertDialogDescription>
            {rule ? (
              <>
                Transactions matching{" "}
                <span className="font-mono">{rule.match_pattern}</span> will go back to being
                coded by the model. Past codings are not changed. The rule is retired rather than
                erased, so the record of what was taught survives.
              </>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteRule.isPending}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void confirm();
            }}
            disabled={deleteRule.isPending}
          >
            {deleteRule.isPending ? <Spinner /> : null}
            Retire the rule
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
