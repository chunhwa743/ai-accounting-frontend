"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, FileUp, Play, X } from "lucide-react";

import { ErrorState, Spinner } from "@/components/domain/states";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClient, useStartRun, useUploadDocuments } from "@/lib/api/queries";
import { formatBytes, pluralise } from "@/lib/domain/format";
import { cn } from "@/lib/utils";

/** The backend's own per-file ceiling. Checked here so the 413 is a backstop. */
const MAX_BYTES = 50 * 1024 * 1024;

/** What the ingestion router can actually read. Anything else is ignored silently. */
const READABLE = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
  ".csv",
  ".tsv",
  ".xlsx",
  ".xls",
  ".docx",
  ".txt",
  ".md",
];

function extensionOf(name: string): string {
  const at = name.lastIndexOf(".");
  return at === -1 ? "" : name.slice(at).toLowerCase();
}

export function NewRun({ clientId }: { clientId: number }) {
  const router = useRouter();
  const { data: client } = useClient(clientId);
  const upload = useUploadDocuments(clientId);
  const startRun = useStartRun(clientId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  const oversize = files.filter((file) => file.size > MAX_BYTES);
  const unreadable = files.filter((file) => !READABLE.includes(extensionOf(file.name)));
  const busy = upload.isPending || startRun.isPending;
  const canStart = files.length > 0 && oversize.length === 0 && !busy;

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const next = Array.from(incoming);
    setFiles((current) => {
      const seen = new Set(current.map((file) => `${file.name}:${file.size}`));
      return [...current, ...next.filter((file) => !seen.has(`${file.name}:${file.size}`))];
    });
  }

  async function start() {
    // Upload stages the bytes and hands back server-side paths; nothing is read
    // until the run itself, and no Document rows exist yet.
    const staged = await upload.mutateAsync(files);
    const run = await startRun.mutateAsync({
      file_paths: staged.staged.map((file) => file.path),
    });
    router.push(`/clients/${clientId}/runs/${run.run_id}`);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">New run</h2>
        <p className="text-muted-foreground text-sm">
          Upload this period&rsquo;s bank statement, plus any invoices, receipts and payroll
          summaries that go with it.
        </p>
      </div>

      {/* The client is chosen by the accountant and never inferred. Posting one
          company's statement into another's books cannot be undone, so say
          plainly whose books these files are about to land in. */}
      <Alert>
        <FileUp />
        <AlertTitle>
          These files will be posted to {client?.name ?? "this client"}&rsquo;s books
        </AlertTitle>
        <AlertDescription>
          The account-holder name on the statement is used only to check that choice. If this is
          the wrong client, go back and pick another before uploading.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Files</CardTitle>
          <CardDescription>
            PDF (digital or scanned), images, CSV, XLSX, DOCX or plain text. Up to 50 MB each.
            Re-uploading a file you have sent before is safe — it is recognised by content and its
            existing reading is reused.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(event.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center transition-colors",
              dragging ? "border-foreground bg-muted/50" : "hover:bg-muted/30",
            )}
          >
            <FileUp className="text-muted-foreground size-6" />
            <p className="text-sm font-medium">Drop files here, or click to choose</p>
            <p className="text-muted-foreground text-xs">
              Everything for the period can go in at once.
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {files.length > 0 ? (
            <ul className="divide-y rounded-lg border">
              {files.map((file, index) => {
                const tooBig = file.size > MAX_BYTES;
                const unknown = !READABLE.includes(extensionOf(file.name));
                return (
                  <li
                    key={`${file.name}:${file.size}:${index}`}
                    className="flex items-center gap-3 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    {unknown ? (
                      <span className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="size-3.5" />
                        not a readable type
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "font-mono text-xs tabular-nums",
                        tooBig ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {formatBytes(file.size)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="size-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {oversize.length > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>
                {oversize.map((file) => file.name).join(", ")} —{" "}
                {oversize.length === 1 ? "this file is" : "these files are"} over the 50 MB limit
                and must be removed.
              </AlertDescription>
            </Alert>
          ) : null}

          {unreadable.length > 0 && oversize.length === 0 ? (
            <Alert>
              <AlertTriangle />
              <AlertDescription>
                {unreadable.map((file) => file.name).join(", ")} will be uploaded but not read —
                the run only understands PDFs, images, spreadsheets, DOCX and plain text.
              </AlertDescription>
            </Alert>
          ) : null}

          {upload.error ? <ErrorState error={upload.error} title="Upload failed" /> : null}
          {startRun.error ? (
            <ErrorState error={startRun.error} title="Could not start the run" />
          ) : null}

          <div className="flex items-center gap-3">
            <Button onClick={() => void start()} disabled={!canStart}>
              {busy ? <Spinner /> : <Play className="size-4" />}
              {upload.isPending
                ? "Uploading…"
                : startRun.isPending
                  ? "Starting…"
                  : "Start run"}
            </Button>
            {files.length > 0 ? (
              <span className="text-muted-foreground text-sm">
                {pluralise(files.length, "file")} ready
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
