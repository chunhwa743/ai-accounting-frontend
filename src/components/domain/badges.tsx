"use client";

import { AlertTriangle, Info, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AllocationStatus, DecisionMethod, RunStatus } from "@/lib/api/types";
import {
  ALLOCATION_STATUS,
  DECISION_METHOD,
  HIGH_RISK_EXPLANATION,
  RUN_STATUS,
} from "@/lib/domain/vocabulary";
import { cn } from "@/lib/utils";

/**
 * The base theme is deliberately neutral, so status colour is defined here and
 * nowhere else. Each tone reads in both light and dark.
 */
const TONE = {
  query: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  review: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  done: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  quiet: "bg-muted text-muted-foreground",
  bad: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
} as const;

const ALLOCATION_TONE: Record<AllocationStatus, keyof typeof TONE> = {
  CLIENT_QUERY: "query",
  NEEDS_REVIEW: "review",
  APPROVED: "done",
  AUTO_POSTED: "quiet",
};

export function AllocationStatusBadge({
  status,
  className,
}: {
  status: AllocationStatus;
  className?: string;
}) {
  const meta = ALLOCATION_STATUS[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className={cn(TONE[ALLOCATION_TONE[status]], className)}>
          {meta.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{meta.explanation}</TooltipContent>
    </Tooltip>
  );
}

const RUN_TONE: Record<RunStatus, keyof typeof TONE> = {
  RUNNING: "review",
  AWAITING_EXTRACTION_REVIEW: "query",
  AWAITING_REVIEW: "review",
  COMPLETED: "done",
  FAILED: "bad",
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const meta = RUN_STATUS[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className={TONE[RUN_TONE[status]]}>
          {meta.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{meta.explanation}</TooltipContent>
    </Tooltip>
  );
}

/**
 * How this coding was arrived at.
 *
 * Watching "learned rule" accumulate month over month is how the accountant
 * experiences their corrections paying off, so it is worth a badge of its own
 * rather than being folded into the confidence figure.
 */
export function DecisionMethodBadge({ method }: { method: DecisionMethod }) {
  const meta = DECISION_METHOD[method];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className={cn(
            "font-normal",
            method === "RULE" && "border-emerald-300 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300",
            method === "HUMAN" && "border-blue-300 text-blue-800 dark:border-blue-800 dark:text-blue-300",
          )}
        >
          {meta.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{meta.explanation}</TooltipContent>
    </Tooltip>
  );
}

/**
 * How far the system's own answer can be trusted.
 *
 * `null` never renders as zero. A confidence of null means a person decided, and
 * a human's answer is not a probability - showing "0%" would be a lie about the
 * most reliable rows on the screen.
 */
export function ConfidenceIndicator({
  confidence,
  decisionMethod,
}: {
  confidence: number | null;
  decisionMethod: DecisionMethod;
}) {
  if (confidence === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-muted-foreground text-xs">
            {decisionMethod === "HUMAN" ? "set by you" : "no score"}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {DECISION_METHOD[decisionMethod].explanation}
        </TooltipContent>
      </Tooltip>
    );
  }

  // The backend's routing bands: at or above 0.90 posts unreviewed, 0.60 to 0.90
  // is a review, below 0.60 becomes a client query.
  const tone =
    confidence >= 0.9
      ? "bg-emerald-500"
      : confidence >= 0.6
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-2">
          <span className="bg-muted h-1.5 w-10 overflow-hidden rounded-full">
            <span
              className={cn("block h-full rounded-full", tone)}
              style={{ width: `${Math.round(confidence * 100)}%` }}
            />
          </span>
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            {Math.round(confidence * 100)}%
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        Measured by the system from several signals, not reported by the model. At or above 90%
        it posts without review; below 60% it becomes a client query.
      </TooltipContent>
    </Tooltip>
  );
}

export function HighRiskMarker({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ShieldAlert className={cn("size-3.5 shrink-0 text-amber-600", className)} />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{HIGH_RISK_EXPLANATION}</TooltipContent>
    </Tooltip>
  );
}

export function InfoHint({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="text-muted-foreground size-3.5 shrink-0" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  );
}

export function WarningHint({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  );
}
