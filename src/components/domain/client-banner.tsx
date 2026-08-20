"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useClient } from "@/lib/api/queries";
import { cn } from "@/lib/utils";

/**
 * Which client's books are open, on every client-scoped screen.
 *
 * The client is chosen by the accountant and never inferred. Posting one
 * company's statement into another's books is unrecoverable, so this stays
 * visible rather than being a value buried in a form.
 */
export function ClientBanner({ clientId }: { clientId: number }) {
  const { data: client, isLoading } = useClient(clientId);
  const pathname = usePathname();

  const tabs = [
    { href: `/clients/${clientId}`, label: "Runs" },
    { href: `/clients/${clientId}/rules`, label: "Learned rules" },
    { href: `/clients/${clientId}/metrics`, label: "Learning curve" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Building2 className="text-muted-foreground size-5 shrink-0" />
        {isLoading || !client ? (
          <Skeleton className="h-7 w-64" />
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">{client.name}</h1>
            {client.uen ? (
              <Badge variant="outline" className="font-mono">
                {client.uen}
              </Badge>
            ) : null}
            {!client.profile.gst_registered ? (
              <Badge variant="secondary">Not GST registered</Badge>
            ) : null}
          </>
        )}
      </div>

      <nav className="flex gap-1 border-b">
        {tabs.map((tab) => {
          const active =
            tab.href === `/clients/${clientId}`
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "border-b-2 px-3 py-2 text-sm transition-colors",
                active
                  ? "border-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
