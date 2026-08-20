"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAccounts } from "@/lib/api/queries";
import type { Account } from "@/lib/api/types";
import { ACCOUNT_TYPE_ORDER, ACCOUNT_TYPE_STATEMENT } from "@/lib/domain/vocabulary";
import { cn } from "@/lib/utils";
import { HighRiskMarker } from "./badges";

/**
 * Picks an account from the chart of accounts.
 *
 * There is deliberately no free-text entry. The system selects from this list
 * and never adds to it: allowing new codes here would fragment the chart into
 * `Telephone`, `Phone` and `Telco` within a month, and every report after that
 * would be wrong.
 *
 * Accounts are grouped by type because the type decides which financial
 * statement the amount lands on, and searchable by code because that is how
 * accountants actually work.
 */
export function AccountPicker({
  value,
  onChange,
  disabled,
  placeholder = "Choose an account",
}: {
  value: string | null;
  onChange: (account: Account) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: accounts, isLoading } = useAccounts();

  const grouped = useMemo(() => {
    const byType = new Map<string, Account[]>();
    for (const account of accounts ?? []) {
      const list = byType.get(account.type) ?? [];
      list.push(account);
      byType.set(account.type, list);
    }
    return ACCOUNT_TYPE_ORDER.filter((type) => byType.has(type)).map((type) => ({
      type,
      accounts: byType.get(type)!,
    }));
  }, [accounts]);

  const selected = accounts?.find((account) => account.code === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="flex min-w-0 items-center gap-2">
              <span className="font-mono text-xs tabular-nums">{selected.code}</span>
              <span className="truncate">{selected.name}</span>
              {selected.risk_level === "HIGH" ? <HighRiskMarker /> : null}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {isLoading ? "Loading accounts…" : placeholder}
            </span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search by code or name…" />
          <CommandList className="max-h-80">
            <CommandEmpty>
              No account matches. The chart of accounts is fixed — nothing can be added here.
            </CommandEmpty>
            {grouped.map((group) => (
              <CommandGroup
                key={group.type}
                heading={
                  <span className="flex items-center justify-between">
                    <span>{group.type}</span>
                    <span className="text-muted-foreground text-[10px] font-normal">
                      {ACCOUNT_TYPE_STATEMENT[group.type]}
                    </span>
                  </span>
                }
              >
                {group.accounts.map((account) => (
                  <CommandItem
                    key={account.code}
                    // Searchable by code and by name.
                    value={`${account.code} ${account.name}`}
                    onSelect={() => {
                      onChange(account);
                      setOpen(false);
                    }}
                    className="items-start gap-2"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        account.code === value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="font-mono text-xs tabular-nums">{account.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{account.name}</span>
                        {account.risk_level === "HIGH" ? <HighRiskMarker /> : null}
                      </span>
                      {account.notes ? (
                        <span className="text-muted-foreground block text-xs">
                          {account.notes}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      {account.default_tax_code}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
