"use client";

import Link from "next/link";
import { Lightbulb, Plus } from "lucide-react";

import { RunStatusBadge } from "@/components/domain/badges";
import { EmptyState, ErrorState, LoadingRows } from "@/components/domain/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientMetrics, useClientProfile } from "@/lib/api/queries";
import { formatDateTime } from "@/lib/domain/format";

/**
 * A client's runs.
 *
 * A run is a place the accountant comes back to, not a wizard they have to
 * finish in one sitting: it can sit for days waiting on an answer from the
 * client. This list is the way back into one.
 */
export function RunsOverview({ clientId }: { clientId: number }) {
  const { data: metrics, isLoading, error } = useClientMetrics(clientId);
  const { data: profile } = useClientProfile(clientId);

  // The API returns runs oldest first; the newest is what you almost always want.
  const runs = [...(metrics?.runs ?? [])].reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Runs</h2>
          <p className="text-muted-foreground text-sm">
            One run is one batch of files: statements in, coded transactions out.
          </p>
        </div>
        <Button asChild>
          <Link href={`/clients/${clientId}/runs/new`}>
            <Plus className="size-4" />
            New run
          </Link>
        </Button>
      </div>

      {error ? <ErrorState error={error} title="Could not load runs" /> : null}
      {isLoading ? <LoadingRows rows={3} /> : null}

      {metrics && runs.length === 0 ? (
        <EmptyState title="No runs yet">
          Upload this month&rsquo;s bank statement and any invoices to get started.
        </EmptyState>
      ) : null}

      {runs.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium">
                <th>Run</th>
                <th>Started</th>
                <th>Status</th>
                <th className="text-right!">Lines</th>
                <th className="text-right!">Needs attention</th>
                <th className="text-right!">From learned rules</th>
                <th className="text-right!">Model calls</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
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
                    {formatDateTime(run.started_at) || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <RunStatusBadge status={run.status} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {run.transactions}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {run.needs_attention > 0 ? (
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        {run.needs_attention}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {run.resolved_without_model > 0 ? (
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        {run.resolved_without_model}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="text-muted-foreground px-3 py-2 text-right font-mono tabular-nums">
                    {run.llm_calls}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {profile && profile.learned_facts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="size-4" />
              What the system has been told about this client
            </CardTitle>
            <CardDescription>
              Answers to past client queries. These become context for the next run, so the same
              question does not get asked twice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm">
              {profile.learned_facts.map((fact, index) => (
                <li key={index} className="text-muted-foreground flex gap-2">
                  <span className="text-muted-foreground/60">&bull;</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
