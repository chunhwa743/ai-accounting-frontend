"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";

import { RunStatusBadge } from "@/components/domain/badges";
import { ErrorState, LoadingRows } from "@/components/domain/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useRun } from "@/lib/api/queries";
import type { Run } from "@/lib/api/types";
import { formatDateTime } from "@/lib/domain/format";
import { ExtractionIssues } from "./_components/extraction-issues";
import { ReviewQueue } from "./_components/review-queue";
import { CompleteRunButton, ExportMenu } from "./_components/run-actions";
import { RunProgress } from "./_components/run-progress";

/**
 * One run, whatever state it is in.
 *
 * A run is a place the accountant comes back to rather than a wizard: the gap
 * between starting it and finishing it can be days, because a client query goes
 * out by email and the answer takes as long as it takes. The status decides what
 * this page offers, and nothing here has to be done in one sitting.
 */
export function RunWorkspace({ runId, clientId }: { runId: number; clientId: number }) {
  const { data: run, isLoading, error } = useRun(runId);

  if (error) return <ErrorState error={error} title="Could not load this run" />;
  if (isLoading || !run) return <LoadingRows rows={4} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/clients/${clientId}`}>
            <ArrowLeft className="size-4" />
            All runs
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">Run {run.id}</h2>
        <RunStatusBadge status={run.status} />
        {run.started_at ? (
          <span className="text-muted-foreground text-xs">
            started {formatDateTime(run.started_at)}
          </span>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {run.status === "AWAITING_REVIEW" || run.status === "COMPLETED" ? (
            <ExportMenu runId={run.id} />
          ) : null}
          {run.status === "AWAITING_REVIEW" ? (
            <CompleteRunButton run={run} clientId={clientId} />
          ) : null}
        </div>
      </div>

      {run.status !== "RUNNING" ? <RunStats run={run} /> : null}

      {run.status === "RUNNING" ? (
        <RunProgress runId={run.id} startedAt={run.started_at} />
      ) : null}

      {run.status === "AWAITING_EXTRACTION_REVIEW" ? (
        <ExtractionIssues runId={run.id} clientId={clientId} />
      ) : null}

      {run.status === "FAILED" ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>This run failed and cannot be resumed</AlertTitle>
          <AlertDescription>
            {/* The backend records the error on the run row but does not expose
                it through the API, so there is nothing more specific to show. */}
            The reason is recorded on the server but is not available here. Start a new run over
            the same files — anything already read will be reused.
          </AlertDescription>
        </Alert>
      ) : null}

      {run.status === "AWAITING_REVIEW" || run.status === "COMPLETED" ? (
        <ReviewQueue runId={run.id} clientId={clientId} />
      ) : null}
    </div>
  );
}

function RunStats({ run }: { run: Run }) {
  const total = Object.values(run.by_status).reduce((sum, count) => sum + count, 0);
  const fromRules = run.by_decision_method.RULE ?? 0;

  const stats: {
    label: string;
    value: number;
    tone?: "warn" | "good";
    hint?: string;
  }[] = [
    { label: "Transactions", value: total },
    {
      label: "Needs attention",
      value: run.needs_attention,
      tone: run.needs_attention > 0 ? "warn" : undefined,
    },
    {
      label: "From learned rules",
      value: fromRules,
      tone: fromRules > 0 ? "good" : undefined,
      hint: "Resolved without calling the model at all.",
    },
    { label: "Model calls", value: run.llm_calls },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border p-3">
          <div className="text-muted-foreground text-xs">{stat.label}</div>
          <div
            className={
              stat.tone === "warn"
                ? "text-2xl font-semibold text-amber-700 tabular-nums dark:text-amber-400"
                : stat.tone === "good"
                  ? "text-2xl font-semibold text-emerald-700 tabular-nums dark:text-emerald-400"
                  : "text-2xl font-semibold tabular-nums"
            }
          >
            {stat.value}
          </div>
          {stat.hint ? (
            <div className="text-muted-foreground mt-0.5 text-xs">{stat.hint}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
