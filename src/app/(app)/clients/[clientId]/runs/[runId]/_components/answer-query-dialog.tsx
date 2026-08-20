"use client";

import { useId, useState } from "react";
import { Info } from "lucide-react";
import { toast } from "sonner";

import { AccountPicker } from "@/components/domain/account-picker";
import { Spinner } from "@/components/domain/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { useAnswerQuery } from "@/lib/api/queries";
import type { Account, ReviewItem } from "@/lib/api/types";

/**
 * Records what the client came back with.
 *
 * The answer is stored as a durable fact on the client profile, so the next run
 * has the context this one lacked. Giving an account as well settles the line;
 * without one the answer is still recorded but the query deliberately stays
 * open, which is right when the reply clarifies without deciding.
 */
export function AnswerQueryDialog({
  item,
  runId,
  clientId,
  open,
  onOpenChange,
}: {
  item: ReviewItem;
  runId: number;
  clientId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { allocation, transaction } = item;
  const answerQuery = useAnswerQuery(runId, clientId);
  const fieldId = useId();

  const [answer, setAnswer] = useState("");
  const [account, setAccount] = useState<Account | null>(null);

  async function save() {
    if (!answer.trim()) return;
    try {
      const result = await answerQuery.mutateAsync({
        allocationId: allocation.id,
        input: {
          answer: answer.trim(),
          ...(account ? { account_code: account.code } : {}),
        },
      });
      toast.success(result.message, {
        description: account
          ? "Recorded on the client profile and applied to this line."
          : "Recorded on the client profile. This line is still open — give it an account when you know one.",
      });
      setAnswer("");
      setAccount(null);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : "the answer could not be recorded",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record the client&rsquo;s answer</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {transaction.raw_description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {allocation.question ? (
            <blockquote className="border-l-2 border-amber-400 pl-3 text-sm italic">
              {allocation.question}
            </blockquote>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`${fieldId}-answer`}>What they said</Label>
            <Textarea
              id={`${fieldId}-answer`}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="e.g. freelance illustrator we use per project"
              rows={3}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Account (optional)</Label>
            <AccountPicker
              value={account?.code ?? null}
              onChange={setAccount}
              placeholder="Leave empty to keep this open"
            />
          </div>

          {!account ? (
            <Alert>
              <Info />
              <AlertDescription>
                Without an account this stays a client query. The answer is still remembered for
                next month.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={answerQuery.isPending}
          >
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={!answer.trim() || answerQuery.isPending}>
            {answerQuery.isPending ? <Spinner /> : null}
            Record answer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
