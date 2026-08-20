"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

import { Spinner } from "@/components/domain/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRunEvents } from "./use-run-events";

/** The line worth featuring: past corrections paying for themselves. */
const LEARNING_LINE = /resolved by learned rules with no model call/i;

/**
 * What to show while a run is in flight.
 *
 * The backend publishes no intermediate progress at all - the whole log arrives
 * at once when the pipeline returns - so there is no honest percentage to draw.
 * An indeterminate bar and an elapsed clock say what is actually known. Offline
 * this is over in a second or two; against the live model it can take minutes.
 */
export function RunProgress({ runId, startedAt }: { runId: number; startedAt: string | null }) {
  const messages = useRunEvents(runId, true);
  const elapsed = useElapsed(startedAt);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Spinner />
          Reading the files and coding the transactions
        </CardTitle>
        <CardDescription>
          Classify each file, pull out the transactions, check the arithmetic, then work out what
          each line was for. You can leave this page — the run carries on without you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Deliberately indeterminate. The backend reports no intermediate
            progress, so any percentage here would be invented. */}
        <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
          <div className="bg-foreground/40 h-full w-full animate-pulse rounded-full" />
        </div>

        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>{elapsed !== null ? `${elapsed}s elapsed` : "Starting…"}</span>
          <span>Checking every second and a half.</span>
        </div>

        {messages.length > 0 ? (
          <ul className="space-y-1 font-mono text-xs">
            {messages.map((message, index) => (
              <li
                key={index}
                className={
                  LEARNING_LINE.test(message)
                    ? "flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground"
                }
              >
                {LEARNING_LINE.test(message) ? <Sparkles className="size-3.5" /> : null}
                {message}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

function useElapsed(startedAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!startedAt) return null;
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return null;
  return Math.max(0, Math.floor((now - started) / 1000));
}
