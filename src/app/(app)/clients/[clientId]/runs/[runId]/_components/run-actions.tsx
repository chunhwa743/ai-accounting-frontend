"use client";

import { useState } from "react";
import { CheckCheck, Download } from "lucide-react";
import { toast } from "sonner";

import { Spinner } from "@/components/domain/states";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError, apiUrl } from "@/lib/api/client";
import { useCompleteRun } from "@/lib/api/queries";
import type { Run } from "@/lib/api/types";
import { pluralise } from "@/lib/domain/format";

/**
 * The exports.
 *
 * Plain anchors rather than fetch-and-blob: the proxy carries the session on a
 * cookie, so the browser can download these directly, filename header and all.
 */
export function ExportMenu({ runId }: { runId: number }) {
  const formats = [
    { format: "xlsx", label: "Review pack (Excel)", hint: "Colour-coded by status" },
    { format: "csv", label: "Review pack (CSV)", hint: "The same, as plain text" },
    { format: "journal", label: "Journal entries (CSV)", hint: "Double-entry lines" },
  ] as const;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="size-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Download</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formats.map((entry) => (
          <DropdownMenuItem key={entry.format} asChild>
            <a href={apiUrl(`/runs/${runId}/export?format=${entry.format}`)} download>
              <span>
                <span className="block">{entry.label}</span>
                <span className="text-muted-foreground block text-xs">{entry.hint}</span>
              </span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Signs the run off.
 *
 * Completion does not refuse outstanding items - sometimes a month closes with
 * two queries still sitting with the client - but it says plainly how many are
 * being left open. Sign-off is at the batch level: the reviewer takes
 * responsibility for the run rather than initialling all forty-five lines, which
 * is why most allocations keep `approved_by: null` and that is not a gap.
 */
export function CompleteRunButton({
  run,
  clientId,
}: {
  run: Run;
  clientId: number;
}) {
  const [open, setOpen] = useState(false);
  const complete = useCompleteRun(run.id, clientId);
  const outstanding = run.needs_attention;

  async function confirm() {
    try {
      const result = await complete.mutateAsync();
      toast.success(
        result.still_unresolved === 0
          ? "Run completed. Everything was resolved."
          : `Run completed with ${pluralise(result.still_unresolved, "item")} left open.`,
        { description: "The review pack, journal and client query list have been regenerated." },
      );
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "the run could not be completed",
      );
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <CheckCheck className="size-4" />
        Complete run
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign off run {run.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              {outstanding > 0 ? (
                <>
                  <strong>
                    {pluralise(outstanding, "transaction")} will be left open
                  </strong>{" "}
                  — {run.by_status.CLIENT_QUERY ?? 0} still waiting on the client and{" "}
                  {run.by_status.NEEDS_REVIEW ?? 0} still needing your review. That is allowed, and
                  sometimes right, but it will be recorded that way.
                </>
              ) : (
                "Everything on this run has been resolved."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={complete.isPending}>Not yet</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirm();
              }}
              disabled={complete.isPending}
            >
              {complete.isPending ? <Spinner /> : null}
              Complete run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
