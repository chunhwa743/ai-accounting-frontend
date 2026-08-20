"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingRows, Spinner } from "@/components/domain/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ApiError } from "@/lib/api/client";
import { useBulkApprove, useRunSummary, useRunTransactions } from "@/lib/api/queries";
import type { AllocationStatus, ReviewItem } from "@/lib/api/types";
import { pluralise } from "@/lib/domain/format";
import { ALLOCATION_STATUS } from "@/lib/domain/vocabulary";
import { cn } from "@/lib/utils";
import { ReviewRow } from "./review-row";
import { TransactionSheet } from "./transaction-sheet";

/**
 * The order the bands appear in, and how each behaves.
 *
 * Client queries and reviews are deliberately kept apart. A review is a
 * judgement the accountant can make in seconds from knowing the client; a client
 * query leaves the building - it is an email, and then a wait of days. Batching
 * them into one list would hide how much of the work is actually finishable
 * today, which is the single most useful thing this screen can tell someone.
 */
const BANDS: {
  status: AllocationStatus;
  openByDefault: boolean;
  /** Bulk approve is never offered across client queries. */
  allowBulk: boolean;
}[] = [
  { status: "CLIENT_QUERY", openByDefault: true, allowBulk: false },
  { status: "NEEDS_REVIEW", openByDefault: true, allowBulk: true },
  { status: "APPROVED", openByDefault: false, allowBulk: false },
  { status: "AUTO_POSTED", openByDefault: false, allowBulk: true },
];

export function ReviewQueue({ runId, clientId }: { runId: number; clientId: number }) {
  const { data, isLoading, error } = useRunTransactions(runId);
  const [detailId, setDetailId] = useState<number | null>(null);

  // Selection is scoped to one band and cleared the moment another is touched,
  // so a bulk approve can never reach across a status boundary.
  const [selection, setSelection] = useState<{ band: AllocationStatus; ids: Set<number> } | null>(
    null,
  );

  const byStatus = useMemo(() => {
    const map = new Map<AllocationStatus, ReviewItem[]>();
    for (const item of data?.items ?? []) {
      const list = map.get(item.allocation.status) ?? [];
      list.push(item);
      map.set(item.allocation.status, list);
    }
    return map;
  }, [data]);

  if (error) return <ErrorState error={error} title="Could not load the queue" />;
  if (isLoading) return <LoadingRows rows={5} />;
  if (!data || data.count === 0) {
    return (
      <EmptyState title="Nothing to review">
        This run produced no transactions. If it was superseded by a later run, its documents were
        moved across with it.
      </EmptyState>
    );
  }

  function toggle(band: AllocationStatus, allocationId: number, on: boolean) {
    setSelection((current) => {
      const ids = current?.band === band ? new Set(current.ids) : new Set<number>();
      if (on) ids.add(allocationId);
      else ids.delete(allocationId);
      return ids.size === 0 ? null : { band, ids };
    });
  }

  return (
    <div className="space-y-4">
      {BANDS.map(({ status, openByDefault, allowBulk }) => {
        const items = byStatus.get(status) ?? [];
        if (items.length === 0) return null;

        return (
          <Band
            key={status}
            status={status}
            items={items}
            openByDefault={openByDefault}
            allowBulk={allowBulk}
            runId={runId}
            clientId={clientId}
            selection={selection?.band === status ? selection.ids : null}
            onToggle={(allocationId, on) => toggle(status, allocationId, on)}
            onClearSelection={() => setSelection(null)}
            onSelectAll={() =>
              setSelection({
                band: status,
                ids: new Set(
                  items
                    .filter((item) => item.allocation.account_id !== null)
                    .map((item) => item.allocation.id),
                ),
              })
            }
            onOpenDetail={setDetailId}
          />
        );
      })}

      <TransactionSheet
        transactionId={detailId}
        runId={runId}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
      />
    </div>
  );
}

function Band({
  status,
  items,
  openByDefault,
  allowBulk,
  runId,
  clientId,
  selection,
  onToggle,
  onClearSelection,
  onSelectAll,
  onOpenDetail,
}: {
  status: AllocationStatus;
  items: ReviewItem[];
  openByDefault: boolean;
  allowBulk: boolean;
  runId: number;
  clientId: number;
  selection: Set<number> | null;
  onToggle: (allocationId: number, on: boolean) => void;
  onClearSelection: () => void;
  onSelectAll: () => void;
  onOpenDetail: (transactionId: number) => void;
}) {
  const [open, setOpen] = useState(openByDefault);
  const meta = ALLOCATION_STATUS[status];
  const bulkApprove = useBulkApprove(runId, clientId);
  const selectedCount = selection?.size ?? 0;

  async function approveSelected() {
    if (!selection || selection.size === 0) return;
    try {
      const result = await bulkApprove.mutateAsync({
        allocation_ids: [...selection],
        // create_rule is deliberately not offered here: the backend fires one
        // model call per allocation to propose a pattern, and a rule made
        // without seeing its preview count is exactly the mistake to avoid.
        create_rule: false,
      });
      onClearSelection();

      if (result.skipped.length === 0) {
        toast.success(`Approved ${pluralise(result.approved.length, "transaction")}.`);
      } else {
        toast.warning(
          `Approved ${result.approved.length}, skipped ${result.skipped.length}.`,
          {
            description: result.skipped
              .map((skip) => `#${skip.allocation_id}: ${skip.reason}`)
              .join(" · "),
            duration: 10000,
          },
        );
      }
    } catch (error) {
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "the bulk approval failed",
      );
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-3 p-3">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 px-2">
            <ChevronDown
              className={cn("size-4 transition-transform", !open && "-rotate-90")}
            />
            <span className="font-medium">{meta.label}</span>
            <Badge variant="secondary">{items.length}</Badge>
          </Button>
        </CollapsibleTrigger>

        <p className="text-muted-foreground hidden flex-1 text-xs lg:block">
          {meta.explanation}
        </p>

        {status === "CLIENT_QUERY" ? <CopyQueriesButton runId={runId} /> : null}

        {allowBulk && open ? (
          selectedCount > 0 ? (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {pluralise(selectedCount, "selected")}
              </span>
              <Button size="sm" variant="ghost" onClick={onClearSelection}>
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => void approveSelected()}
                disabled={bulkApprove.isPending}
              >
                {bulkApprove.isPending ? <Spinner /> : null}
                Approve {selectedCount}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="ml-auto" onClick={onSelectAll}>
              Select all resolved
            </Button>
          )
        ) : null}
      </div>

      <CollapsibleContent>
        <div className="space-y-2 border-t p-3">
          {items.map((item) => (
            <ReviewRow
              key={item.allocation.id}
              item={item}
              runId={runId}
              clientId={clientId}
              selected={selection?.has(item.allocation.id) ?? false}
              onSelectedChange={
                allowBulk ? (on) => onToggle(item.allocation.id, on) : undefined
              }
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * The questions are already written for sending, so getting them all onto the
 * clipboard in one go saves real time.
 */
function CopyQueriesButton({ runId }: { runId: number }) {
  const { data, isLoading } = useRunSummary(runId);
  const queries = data?.client_queries ?? [];

  async function copy() {
    const text = queries
      .map((query) => `${query.date} · ${query.description} · ${query.amount}\n${query.question}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${pluralise(queries.length, "question")} to the clipboard.`);
    } catch {
      toast.error("Could not reach the clipboard.");
    }
  }

  if (isLoading || queries.length === 0) return null;

  return (
    <Button size="sm" variant="outline" onClick={() => void copy()}>
      <Copy className="size-4" />
      Copy all {queries.length} questions
    </Button>
  );
}
