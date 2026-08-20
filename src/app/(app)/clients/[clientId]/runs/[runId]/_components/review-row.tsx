"use client";

import { useId, useState } from "react";
import { Check, MessageSquareQuote, Scissors, SquarePen } from "lucide-react";

import {
  AllocationStatusBadge,
  ConfidenceIndicator,
  DecisionMethodBadge,
} from "@/components/domain/badges";
import { Spinner } from "@/components/domain/states";
import { AccountLabel, LegibilityWarning } from "@/components/domain/statement";
import { TaxCodeLabel } from "@/components/domain/tax-code-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ReviewItem } from "@/lib/api/types";
import { formatDate } from "@/lib/domain/format";
import { formatAmount } from "@/lib/domain/money";
import { splitReasoning } from "@/lib/domain/vocabulary";
import { cn } from "@/lib/utils";
import { AnswerQueryDialog } from "./answer-query-dialog";
import { CorrectDialog } from "./correct-dialog";
import { RuleToggle } from "./rule-toggle";
import { SplitDialog } from "./split-dialog";
import { useReview } from "./use-review";

/**
 * One transaction awaiting a decision.
 *
 * The reasoning is always on screen. The point of the review step is that a
 * person is not blindly accepting a generated answer, and a confidence number
 * says how sure the system is, not what it was thinking. Hide the reasoning and
 * the accountant has to re-derive the answer themselves, which is the work this
 * whole system exists to remove.
 */
export function ReviewRow({
  item,
  runId,
  clientId,
  selected,
  onSelectedChange,
  onOpenDetail,
}: {
  item: ReviewItem;
  runId: number;
  clientId: number;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  onOpenDetail: (transactionId: number) => void;
}) {
  const { allocation, transaction } = item;
  const { submit, isPending } = useReview(runId, clientId);
  const rowId = useId();

  const [createRule, setCreateRule] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { thinking, flaggedBecause } = splitReasoning(allocation.reasoning);
  const unresolved = allocation.account_id === null;
  const isApproved = allocation.status === "APPROVED";
  const isQuery = allocation.status === "CLIENT_QUERY";

  async function approve() {
    await submit(allocation.id, { action: "approve", create_rule: createRule });
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-colors",
        selected && "border-foreground/30 bg-muted/40",
      )}
    >
      <div className="flex gap-3">
        {onSelectedChange ? (
          <Checkbox
            className="mt-1"
            checked={selected}
            onCheckedChange={(value) => onSelectedChange(value === true)}
            aria-label={`Select ${transaction.raw_description}`}
          />
        ) : null}

        <div className="min-w-0 flex-1 space-y-2">
          {/* Header: what the bank printed */}
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {formatDate(transaction.txn_date)}
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-mono text-sm">{transaction.raw_description}</span>
              <LegibilityWarning legibility={transaction.field_legibility} />
            </span>
            {transaction.bank_reference ? (
              <span className="text-muted-foreground font-mono text-xs">
                {transaction.bank_reference}
              </span>
            ) : null}

            <span className="flex-1" />

            <span className="font-mono text-sm tabular-nums whitespace-nowrap">
              <span className="text-muted-foreground mr-1.5 text-xs">
                {transaction.money_in ? "in" : "out"}
              </span>
              {formatAmount(transaction.money_in ?? transaction.money_out)}
            </span>
          </div>

          {/* What it was coded to */}
          <div className="flex flex-wrap items-center gap-2">
            <AccountLabel
              code={allocation.account_id}
              name={allocation.account_name}
              className="text-sm font-medium"
            />
            <TaxCodeLabel code={allocation.tax_code} />
            <span className="flex-1" />
            <AllocationStatusBadge status={allocation.status} />
            <DecisionMethodBadge method={allocation.decision_method} />
            <ConfidenceIndicator
              confidence={allocation.confidence}
              decisionMethod={allocation.decision_method}
            />
          </div>

          {flaggedBecause ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <span className="font-medium">Why you are being asked:</span> {flaggedBecause}
            </p>
          ) : null}

          {thinking ? (
            <div className="text-muted-foreground text-sm">
              <p className={cn("whitespace-pre-line", !expanded && "line-clamp-2")}>{thinking}</p>
              {thinking.length > 160 ? (
                <button
                  type="button"
                  onClick={() => setExpanded((current) => !current)}
                  className="text-foreground/70 hover:text-foreground mt-0.5 text-xs underline-offset-2 hover:underline"
                >
                  {expanded ? "Show less" : "Show all reasoning"}
                </button>
              ) : null}
            </div>
          ) : null}

          {allocation.question ? (
            <blockquote className="border-l-2 border-amber-400 pl-3 text-sm italic">
              {allocation.question}
            </blockquote>
          ) : null}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {!isApproved ? (
              unresolved ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* A disabled button swallows pointer events, so the tooltip
                        needs a wrapper to hang off. */}
                    <span className="inline-block">
                      <Button size="sm" disabled>
                        <Check className="size-4" />
                        Approve
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    There is no account on this line yet, so there is nothing to sign off. Give it
                    an account, or leave it as a client query.
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button size="sm" onClick={() => void approve()} disabled={isPending}>
                  {isPending ? <Spinner /> : <Check className="size-4" />}
                  Approve
                </Button>
              )
            ) : null}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setCorrecting(true)}
              disabled={isPending}
            >
              <SquarePen className="size-4" />
              {isApproved ? "Recode" : "Correct"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setSplitting(true)}
              disabled={isPending}
            >
              <Scissors className="size-4" />
              Split
            </Button>

            {isQuery ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAnswering(true)}
                disabled={isPending}
              >
                <MessageSquareQuote className="size-4" />
                Record answer
              </Button>
            ) : null}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenDetail(transaction.id)}
            >
              Detail
            </Button>

            {!isApproved && !unresolved ? (
              <RuleToggle
                id={`${rowId}-rule`}
                checked={createRule}
                onChange={setCreateRule}
                disabled={isPending}
                className="ml-auto"
              />
            ) : null}
          </div>
        </div>
      </div>

      <CorrectDialog
        item={item}
        runId={runId}
        clientId={clientId}
        open={correcting}
        onOpenChange={setCorrecting}
      />
      <SplitDialog
        item={item}
        runId={runId}
        clientId={clientId}
        open={splitting}
        onOpenChange={setSplitting}
      />
      {isQuery ? (
        <AnswerQueryDialog
          item={item}
          runId={runId}
          clientId={clientId}
          open={answering}
          onOpenChange={setAnswering}
        />
      ) : null}
    </div>
  );
}
