"use client";

import {
  AllocationStatusBadge,
  ConfidenceIndicator,
  DecisionMethodBadge,
} from "@/components/domain/badges";
import { DocumentPreview } from "@/components/domain/document-preview";
import { ErrorState, LoadingRows } from "@/components/domain/states";
import { AccountLabel, LegibilityWarning, MoneyPair } from "@/components/domain/statement";
import { TaxCodeLabel } from "@/components/domain/tax-code-picker";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTransaction } from "@/lib/api/queries";
import { formatDate } from "@/lib/domain/format";
import { formatAmount } from "@/lib/domain/money";
import { splitReasoning } from "@/lib/domain/vocabulary";

/**
 * The whole picture for one bank line, beside the paperwork that explains it.
 */
export function TransactionSheet({
  transactionId,
  runId,
  onOpenChange,
}: {
  transactionId: number | null;
  runId: number;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading, error } = useTransaction(transactionId);

  // The endpoint returns every run's allocations for this line, oldest first.
  // Only this run's belong on screen.
  const allocations = data?.allocations.filter((allocation) => allocation.run_id === runId) ?? [];

  return (
    <Sheet open={transactionId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {data ? data.transaction.raw_description : "Transaction"}
          </SheetTitle>
          <SheetDescription>
            {data
              ? `${formatDate(data.transaction.txn_date)} · line ${data.transaction.line_no}`
              : "Loading…"}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-8">
          {error ? <ErrorState error={error} /> : null}
          {isLoading ? <LoadingRows rows={3} /> : null}

          {data ? (
            <>
              <section className="space-y-3">
                <MoneyPair transaction={data.transaction} />
                <dl className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
                  {data.transaction.bank_reference ? (
                    <div>
                      <dt>Reference</dt>
                      <dd className="text-foreground font-mono">
                        {data.transaction.bank_reference}
                      </dd>
                    </div>
                  ) : null}
                  {data.transaction.balance_after ? (
                    <div>
                      <dt>Balance after</dt>
                      <dd className="text-foreground font-mono tabular-nums">
                        {formatAmount(data.transaction.balance_after)}
                      </dd>
                    </div>
                  ) : null}
                  {data.transaction.page ? (
                    <div>
                      <dt>Page</dt>
                      <dd className="text-foreground">{data.transaction.page}</dd>
                    </div>
                  ) : null}
                </dl>
                <LegibilityWarning legibility={data.transaction.field_legibility} />
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="text-sm font-medium">
                  {allocations.length > 1 ? "Allocations" : "Allocation"}
                </h3>
                {allocations.map((allocation) => {
                  const { thinking, flaggedBecause } = splitReasoning(allocation.reasoning);
                  return (
                    <div key={allocation.id} className="space-y-2 rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <AccountLabel
                          code={allocation.account_id}
                          name={allocation.account_name}
                          className="text-sm font-medium"
                        />
                        <TaxCodeLabel code={allocation.tax_code} />
                        <span className="flex-1" />
                        <span className="font-mono text-sm tabular-nums">
                          {formatAmount(allocation.amount)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <AllocationStatusBadge status={allocation.status} />
                        <DecisionMethodBadge method={allocation.decision_method} />
                        <ConfidenceIndicator
                          confidence={allocation.confidence}
                          decisionMethod={allocation.decision_method}
                        />
                      </div>

                      {flaggedBecause ? (
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                          <span className="font-medium">Flagged because:</span> {flaggedBecause}
                        </p>
                      ) : null}

                      {thinking ? (
                        <p className="text-muted-foreground text-sm whitespace-pre-line">
                          {thinking}
                        </p>
                      ) : null}

                      {allocation.question ? (
                        <blockquote className="border-l-2 border-amber-400 pl-3 text-sm italic">
                          {allocation.question}
                        </blockquote>
                      ) : null}
                    </div>
                  );
                })}
              </section>

              {data.matched_document ? (
                <>
                  <Separator />
                  <section>
                    <h3 className="mb-2 text-sm font-medium">Supporting document</h3>
                    <p className="text-muted-foreground mb-3 text-xs">
                      The invoice or receipt this payment settles. It is often the thing that
                      makes the coding obvious — the bank line says who was paid, this says what
                      was bought.
                    </p>
                    <DocumentPreview documentId={data.matched_document.id} />
                  </section>
                </>
              ) : null}

              {data.document ? (
                <>
                  <Separator />
                  <section>
                    <h3 className="mb-2 text-sm font-medium">Source statement</h3>
                    <DocumentPreview
                      documentId={data.document.id}
                      page={data.transaction.page}
                    />
                  </section>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
