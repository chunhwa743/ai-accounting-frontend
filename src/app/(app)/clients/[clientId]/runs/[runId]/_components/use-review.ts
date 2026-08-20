"use client";

import { toast } from "sonner";

import { ApiError } from "@/lib/api/client";
import { useReviewAllocation } from "@/lib/api/queries";
import { pluralise } from "@/lib/domain/format";
import type { ReviewAction, ReviewResult } from "@/lib/api/types";

/**
 * Submits one review and reports what actually happened.
 *
 * Three outcomes need saying out loud, and the API reports them separately:
 *
 * - the coding was applied (`message`, already written for a person);
 * - a rule was learned, and how many past transactions it would have matched
 *   (`rule_preview_count`) - the sanity check that catches a wrong pattern now
 *   rather than three months from now;
 * - the rule was refused (`rule_blocked_reason`). That is not an error. The
 *   correction still applied, and only the permanent rule was declined.
 */
export function useReview(runId: number, clientId: number) {
  const mutation = useReviewAllocation(runId, clientId);

  async function submit(allocationId: number, action: ReviewAction): Promise<ReviewResult | null> {
    try {
      const result = await mutation.mutateAsync({ allocationId, action });
      announce(result);
      return result;
    } catch (error) {
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "the review could not be saved",
      );
      return null;
    }
  }

  return { submit, isPending: mutation.isPending };
}

function announce(result: ReviewResult): void {
  if (result.rule_created && result.rule_preview_count !== null) {
    toast.success(result.message, {
      description: `The pattern "${result.rule_created.match_pattern}" matches ${pluralise(
        result.rule_preview_count,
        "transaction",
      )} already on record. If that number looks wrong, the pattern is wrong.`,
      duration: 8000,
    });
    return;
  }

  if (result.rule_blocked_reason) {
    toast.success(result.message, {
      description: `No rule was created: ${result.rule_blocked_reason}. The coding itself still applied.`,
      duration: 8000,
    });
    return;
  }

  toast.success(result.message);
}
