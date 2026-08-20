"use client";

import { Sparkles } from "lucide-react";

import { InfoHint } from "@/components/domain/badges";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * "Always code this merchant this way".
 *
 * This is the mechanism that makes next month cheaper, so it gets a visible
 * control rather than a line in an advanced section - and it is offered on
 * *approve* as well as on a correction. An accountant confirming a flagged item
 * that was already right is the commonest way a rule ever gets made; offering it
 * only on corrections means most rules never happen.
 */
export function RuleToggle({
  checked,
  onChange,
  id,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5",
        checked && "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40",
        className,
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <Label htmlFor={id} className="cursor-pointer text-xs font-normal">
        <Sparkles className="size-3.5 text-emerald-600" />
        Always code this merchant this way
      </Label>
      <InfoHint>
        Writes a rule for this client only. Next month, matching transactions are coded without
        calling the model at all. You will be shown how many past transactions the pattern would
        have matched before it counts for anything.
      </InfoHint>
    </div>
  );
}
