"use client";

import { useState } from "react";
import Link from "next/link";
import { Calculator, Check, FileWarning } from "lucide-react";
import { toast } from "sonner";

import { DocumentPreview } from "@/components/domain/document-preview";
import { EmptyState, ErrorState, LoadingRows, Spinner } from "@/components/domain/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { useDocument, useExtractionFix, useRunIssues } from "@/lib/api/queries";
import type { BackendDocument, ExtractionIssue } from "@/lib/api/types";

/**
 * The one screen that asks the accountant to open a document and transcribe.
 *
 * It is deliberately small. Only identifiers reach here - account numbers,
 * references, invoice numbers - because ordinary prose survives a missing
 * character while an identifier does not: one wrong digit in an account number
 * means a different account, and nothing downstream can catch it. Unclear text
 * never stops a run; it carries a confidence penalty instead.
 */
export function ExtractionIssues({
  runId,
  clientId,
}: {
  runId: number;
  clientId: number;
}) {
  const { data: issues, isLoading, error } = useRunIssues(runId);

  if (error) return <ErrorState error={error} title="Could not load the issues" />;
  if (isLoading) return <LoadingRows rows={2} />;

  const fixable = (issues ?? []).filter((issue) => issue.field && issue.document_id);
  const informational = (issues ?? []).filter((issue) => !issue.field || !issue.document_id);

  return (
    <div className="space-y-4">
      <Alert>
        <FileWarning />
        <AlertTitle>Something on a page could not be read reliably</AlertTitle>
        <AlertDescription>
          Fix the fields below against the source document, then start a new run with the same
          files. Anything already read is reused, so nothing is done twice — including these
          corrections.
        </AlertDescription>
      </Alert>

      {fixable.length === 0 && informational.length === 0 ? (
        <EmptyState title="No issues recorded">
          This run is waiting on an extraction review but lists no issues. That usually means a
          later run took its documents over — start a new run to carry on.
        </EmptyState>
      ) : null}

      {fixable.map((issue, index) => (
        <FixOneField key={`${issue.document_id}-${issue.field}-${index}`} issue={issue} runId={runId} />
      ))}

      {informational.map((issue, index) => (
        <Alert key={`info-${index}`}>
          <Calculator />
          <AlertTitle>
            {issue.code === "balance_mismatch" ? "The statement did not add up" : issue.code}
          </AlertTitle>
          <AlertDescription>
            {issue.message}
            {issue.code === "balance_mismatch" ? (
              <span className="mt-1 block">
                There is nothing to type here. It is information for you: everything on this
                statement will carry a confidence penalty.
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">When the readings are right</CardTitle>
          <CardDescription>
            {/* There is no resume endpoint - nothing re-enters the pipeline after
                gate 1, so carrying on means a new run over the same files. */}
            Start a new run over the same files. Documents are recognised by their contents, so
            they are not read again — the run picks up from your corrections. The new run replaces
            this one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href={`/clients/${clientId}/runs/new`}>Start a new run</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function FixOneField({ issue, runId }: { issue: ExtractionIssue; runId: number }) {
  const { data: document } = useDocument(issue.document_id);
  const fix = useExtractionFix(runId);
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  const modelRead = document && issue.field ? readField(document, issue.field) : null;

  async function save() {
    if (!value.trim() || !issue.document_id || !issue.field) return;
    try {
      const result = await fix.mutateAsync({
        document_id: issue.document_id,
        field_name: issue.field,
        new_value: value.trim(),
      });
      setSaved(true);
      toast.success(`${result.field} corrected.`, {
        description: result.old_value
          ? `Was "${result.old_value}", now "${result.new_value}".`
          : `Set to "${result.new_value}".`,
      });
    } catch (error) {
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "the correction could not be saved",
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{issue.field?.replace(/_/g, " ")}</CardTitle>
        <CardDescription>{issue.message}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        {issue.document_id ? (
          <DocumentPreview documentId={issue.document_id} page={issue.page} />
        ) : null}

        <div className="space-y-3">
          {modelRead ? (
            <div>
              <div className="text-muted-foreground text-xs">The model read</div>
              <div className="font-mono text-sm">{modelRead}</div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`fix-${issue.document_id}-${issue.field}`}>
              What it actually says
            </Label>
            <Input
              id={`fix-${issue.document_id}-${issue.field}`}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setSaved(false);
              }}
              placeholder={modelRead ?? ""}
              className="font-mono"
            />
          </div>

          <Button onClick={() => void save()} disabled={!value.trim() || fix.isPending}>
            {fix.isPending ? <Spinner /> : saved ? <Check className="size-4" /> : null}
            {saved ? "Saved" : "Save correction"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** The identifier fields that can escalate all live on the document row. */
function readField(document: BackendDocument, field: string): string | null {
  const value = (document as unknown as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}
