"use client";

import { AlertCircle, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/**
 * `ApiError.message` is written for a person by the backend - messages like
 * "the parts total 900.00 but the bank line is 1000.00" are more useful than
 * anything this layer would compose, so they are shown verbatim.
 */
export function ErrorState({
  error,
  title = "Something went wrong",
}: {
  error: unknown;
  title?: string;
}) {
  const message =
    error instanceof ApiError || error instanceof Error
      ? error.message
      : "an unexpected error occurred";

  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function LoadingRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} />;
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <p className="font-medium">{title}</p>
      {children ? <p className="text-muted-foreground mt-1 text-sm">{children}</p> : null}
    </div>
  );
}
