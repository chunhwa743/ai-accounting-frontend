"use client";

import Link from "next/link";

import { InfoHint, RunStatusBadge } from "@/components/domain/badges";
import { EmptyState, ErrorState, LoadingRows } from "@/components/domain/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientMetrics } from "@/lib/api/queries";
import { formatDate } from "@/lib/domain/format";
import { LearningCurve } from "./learning-curve";

/**
 * Whether this is getting cheaper.
 *
 * `resolved_without_model` is the honest measure of that and the one plotted:
 * it counts transactions a learned rule settled without any model call, and it
 * only moves when the accountant's past corrections do real work.
 *
 * `auto_post_rate` is shown per run but deliberately not plotted as a trend. It
 * decays as items get approved - APPROVED replaces AUTO_POSTED in the same
 * counter on the backend - so a fully reviewed run reports zero however well it
 * actually did. Charting it would say the opposite of the truth.
 */
export function ClientMetricsView({ clientId }: { clientId: number }) {
  const { data: metrics, isLoading, error } = useClientMetrics(clientId);

  if (error) return <ErrorState error={error} title="Could not load the metrics" />;
  if (isLoading) return <LoadingRows rows={3} />;
  if (!metrics || metrics.runs.length === 0) {
    return (
      <EmptyState title="No runs to measure yet">
        The learning curve appears once this client has been through a run or two.
      </EmptyState>
    );
  }

  const totalResolved = metrics.runs.reduce((sum, run) => sum + run.resolved_without_model, 0);
  const totalCalls = metrics.runs.reduce((sum, run) => sum + run.llm_calls, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Learning curve</h2>
        <p className="text-muted-foreground text-sm">
          How much of each month the system handles on its own, run by run.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Active rules" value={metrics.active_rules} />
        <Stat
          label="Coded without a model call"
          value={totalResolved}
          hint="Across every run for this client. Each one is a transaction your past corrections settled on their own."
        />
        <Stat label="Model calls, all runs" value={totalCalls} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run by run</CardTitle>
          <CardDescription>
            The left bar should climb and the right bar should fall as the system learns this
            client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LearningCurve runs={metrics.runs} />
        </CardContent>
      </Card>

      {/* The table view the chart's colour pairing obliges, and useful in its
          own right - it carries the figures the chart deliberately leaves out. */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
              <th>Run</th>
              <th>Started</th>
              <th>Status</th>
              <th className="text-right!">Lines</th>
              <th className="text-right!">From learned rules</th>
              <th className="text-right!">Needed a person</th>
              <th className="text-right!">Model calls</th>
              <th className="text-right!">
                <span className="inline-flex items-center gap-1">
                  Auto-post rate
                  <InfoHint>
                    Measured when the run finished. It falls back towards zero as you approve
                    things, because an approved line is no longer counted as auto-posted — so
                    compare it within a run, not across them.
                  </InfoHint>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.runs.map((run) => (
              <tr key={run.run_id} className="hover:bg-muted/40 border-t">
                <td className="px-3 py-2">
                  <Link
                    href={`/clients/${clientId}/runs/${run.run_id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    Run {run.run_id}
                  </Link>
                </td>
                <td className="text-muted-foreground px-3 py-2">
                  {formatDate(run.started_at) || "—"}
                </td>
                <td className="px-3 py-2">
                  <RunStatusBadge status={run.status} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{run.transactions}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {run.resolved_without_model}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{run.needs_attention}</td>
                <td className="text-muted-foreground px-3 py-2 text-right tabular-nums">
                  {run.llm_calls}
                </td>
                <td className="text-muted-foreground px-3 py-2 text-right tabular-nums">
                  {Math.round(run.auto_post_rate * 100)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        {label}
        {hint ? <InfoHint>{hint}</InfoHint> : null}
      </div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
