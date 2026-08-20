"use client";

import { Download, ExternalLink, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiUrl } from "@/lib/api/client";
import { useDocument } from "@/lib/api/queries";
import type { BackendDocument } from "@/lib/api/types";
import { formatDate } from "@/lib/domain/format";
import { formatAmount } from "@/lib/domain/money";
import { LegibilityWarning, ReconcilesBadge } from "./statement";

/** The proxied URL, asking for inline rather than attachment disposition. */
function contentUrl(documentId: number): string {
  return apiUrl(`/documents/${documentId}/content?inline=1`);
}

/**
 * Shows a source document beside the transaction it explains.
 *
 * Rendering it in an `<iframe>` is only possible because the session is a
 * same-origin cookie rather than an Authorization header - the browser attaches
 * it to the frame's own request. There is no page-crop endpoint on the backend,
 * so the whole document is shown and the transaction's page number is offered as
 * a pointer rather than faked.
 */
export function DocumentPreview({
  documentId,
  page,
  className,
}: {
  documentId: number;
  page?: number | null;
  className?: string;
}) {
  const { data: document, isLoading } = useDocument(documentId);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!document) return null;

  const isImage = document.mime_type.startsWith("image/");
  const isPdf = document.mime_type === "application/pdf";
  const canRenderInline = isImage || isPdf;

  return (
    <div className={className}>
      <DocumentSummary document={document} page={page} />

      <div className="mt-3 overflow-hidden rounded-lg border">
        {canRenderInline ? (
          isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- proxied bytes, not a static asset
            <img
              src={contentUrl(document.id)}
              alt={document.original_filename}
              className="max-h-[28rem] w-full object-contain"
            />
          ) : (
            <iframe
              src={contentUrl(document.id)}
              title={document.original_filename}
              className="h-[28rem] w-full"
            />
          )
        ) : (
          <div className="text-muted-foreground flex flex-col items-center gap-2 p-8 text-center text-sm">
            <FileText className="size-6" />
            <span>
              {document.original_filename} cannot be previewed in the browser
              {document.mime_type ? ` (${document.mime_type})` : ""}.
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={contentUrl(document.id)} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            Open
          </a>
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={apiUrl(`/documents/${document.id}/content`)} download>
            <Download className="size-4" />
            Download
          </a>
        </Button>
      </div>
    </div>
  );
}

export function DocumentSummary({
  document,
  page,
}: {
  document: BackendDocument;
  page?: number | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <FileText className="text-muted-foreground size-4 shrink-0" />
        <span className="text-sm font-medium">{document.original_filename}</span>
        <span className="text-muted-foreground text-xs">{document.document_type}</span>
        {document.document_type === "BANK_STATEMENT" ? (
          <ReconcilesBadge reconciles={document.reconciles} />
        ) : null}
        <LegibilityWarning legibility={document.field_legibility} />
        {page ? <span className="text-muted-foreground text-xs">page {page}</span> : null}
      </div>

      {/* What was bought. The bank line only says who was paid, which is what
          separates an office expense from a capitalised asset. */}
      {document.summary ? (
        <p className="text-muted-foreground text-sm">{document.summary}</p>
      ) : null}

      <dl className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <Field label="Vendor" value={document.vendor_name} />
        <Field label="Document no." value={document.doc_number} />
        <Field label="Document date" value={formatDate(document.doc_date)} />
        <Field
          label="Total"
          value={document.total_amount ? formatAmount(document.total_amount) : null}
        />
        <Field
          label="Tax"
          value={document.tax_amount ? formatAmount(document.tax_amount) : null}
        />
        <Field label="Bank" value={document.bank_name} />
        <Field
          label="Period"
          value={
            document.period_start
              ? `${formatDate(document.period_start)} – ${formatDate(document.period_end)}`
              : null
          }
        />
        <Field label="Account no." value={document.account_number} />
      </dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
