"use client";

import { AlertTriangle } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTaxCodes } from "@/lib/api/queries";
import { collapseWhitespace } from "@/lib/domain/format";
import { TAX_CODE_WHY_REVIEW } from "@/lib/domain/vocabulary";

/**
 * Picks a GST code.
 *
 * Three codes force a human look whatever the confidence - `BL`, `TX-RC` and
 * `IM` - because each is a claimability or filing decision with a direct cash
 * consequence. They get a warning marker rather than being left as bare codes.
 */
export function TaxCodePicker({
  value,
  onChange,
  placeholder = "Use the account's default",
  disabled,
}: {
  value: string | null;
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { data: taxCodes, isLoading } = useTaxCodes();

  return (
    <Select value={value ?? undefined} onValueChange={onChange} disabled={disabled || isLoading}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={isLoading ? "Loading tax codes…" : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {(taxCodes ?? []).map((taxCode) => (
          <SelectItem key={taxCode.code} value={taxCode.code}>
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs">{taxCode.code}</span>
              <span>{taxCode.name}</span>
              {taxCode.requires_review ? (
                <AlertTriangle className="size-3.5 text-amber-600" />
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** A tax code shown inline, with the reason it needs a person if it does. */
export function TaxCodeLabel({ code }: { code: string | null }) {
  const { data: taxCodes } = useTaxCodes();
  if (!code) return <span className="text-muted-foreground">—</span>;

  const taxCode = taxCodes?.find((candidate) => candidate.code === code);
  const whyReview = TAX_CODE_WHY_REVIEW[code];

  const label = (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      {code}
      {taxCode?.requires_review ? (
        <AlertTriangle className="size-3 text-amber-600" />
      ) : null}
    </span>
  );

  if (!taxCode) return label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-1">
        <div className="font-medium">{taxCode.name}</div>
        {taxCode.description ? <div>{collapseWhitespace(taxCode.description)}</div> : null}
        {whyReview ? <div className="text-amber-300">{whyReview}</div> : null}
      </TooltipContent>
    </Tooltip>
  );
}
