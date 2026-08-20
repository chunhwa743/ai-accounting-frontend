"use client";

import { useEffect, useRef, useState } from "react";

import { apiUrl } from "@/lib/api/client";

/**
 * Reads the run's progress stream.
 *
 * This is a supplement to polling, never the source of truth for status. Two
 * things about the backend make that necessary:
 *
 * - The stream holds one database session whose identity map keeps returning the
 *   row it first read, so a stream opened while the run is RUNNING never
 *   observes the transition. It loops for five minutes and closes without ever
 *   sending `done`.
 * - Progress is not incremental. The pipeline accumulates its log in graph state
 *   and the API publishes the whole thing at once when the run finishes, so what
 *   arrives is "run queued", a silence, then everything.
 *
 * It is still worth reading: those log lines carry the count of transactions
 * resolved by learned rules with no model call, which is the system showing the
 * accountant's past corrections paying off.
 *
 * `EventSource` cannot be used - it cannot send headers, and while our session
 * is a cookie the stream is parsed by hand anyway to keep the abort behaviour.
 */
export function useRunEvents(runId: number, enabled: boolean): string[] {
  const [messages, setMessages] = useState<string[]>([]);
  const startedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    // One stream per run, even across re-renders.
    if (startedFor.current === runId) return;
    startedFor.current = runId;

    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(apiUrl(`/runs/${runId}/events`), {
          signal: controller.signal,
          headers: { accept: "text/event-stream" },
        });
        if (!response.body) return;

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += value;
          const frames = buffer.split("\n\n");
          // The last piece may be a partial frame.
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            const event = /^event:\s*(.+)$/m.exec(frame)?.[1]?.trim();
            const data = /^data:\s*(.+)$/m.exec(frame)?.[1];
            if (!data) continue;

            try {
              const payload = JSON.parse(data) as { message?: string; status?: string };
              if (event === "progress" && payload.message) {
                setMessages((current) => [...current, payload.message!]);
              } else if (event === "done") {
                return;
              }
            } catch {
              // A frame we cannot parse is not worth failing the stream over.
            }
          }
        }
      } catch {
        // An aborted or refused stream costs nothing: polling carries the status.
      }
    })();

    return () => controller.abort();
  }, [runId, enabled]);

  return messages;
}
