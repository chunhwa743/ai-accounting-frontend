"use client";

import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";

import { EmptyState, ErrorState, LoadingRows } from "@/components/domain/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useClients, useClientRules } from "@/lib/api/queries";
import type { Client } from "@/lib/api/types";
import { formatSGD } from "@/lib/domain/money";
import { pluralise } from "@/lib/domain/format";

export default function ClientsPage() {
  const { data: clients, isLoading, error } = useClients();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="text-muted-foreground text-sm">
          Companies whose books this firm keeps. Pick one to start a run or pick up where you
          left off.
        </p>
      </div>

      {error ? <ErrorState error={error} title="Could not load clients" /> : null}
      {isLoading ? <LoadingRows rows={3} /> : null}

      {clients && clients.length === 0 ? (
        <EmptyState title="No clients yet">
          Clients are master data, seeded on the backend rather than created here.
        </EmptyState>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {clients?.map((client) => <ClientCard key={client.id} client={client} />)}
      </div>
    </div>
  );
}

function ClientCard({ client }: { client: Client }) {
  // Cheap enough per client, and seeing the learned-rule count climb month over
  // month is the clearest sign the system is getting better at this client.
  const { data: rules } = useClientRules(client.id);
  const activeRules = rules?.filter((rule) => rule.is_active).length;

  return (
    <Link href={`/clients/${client.id}`} className="group block">
      <Card className="h-full transition-colors group-hover:border-foreground/20">
        <CardHeader>
          <CardTitle className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-2">
              <Building2 className="text-muted-foreground size-4 shrink-0" />
              <span>{client.name}</span>
            </span>
            <ArrowRight className="text-muted-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground line-clamp-2 text-sm">
            {client.profile.business_description || "No profile description."}
          </p>

          <div className="flex flex-wrap gap-2">
            {client.uen ? (
              <Badge variant="outline" className="font-mono">
                {client.uen}
              </Badge>
            ) : null}
            <Badge variant="secondary">
              {client.profile.gst_registered ? "GST registered" : "Not GST registered"}
            </Badge>
            {activeRules !== undefined ? (
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
              >
                {pluralise(activeRules, "learned rule")}
              </Badge>
            ) : null}
          </div>

          <div className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
            <div>
              <div>Materiality</div>
              <div className="text-foreground font-mono tabular-nums">
                {formatSGD(client.profile.materiality_threshold)}
              </div>
            </div>
            <div>
              <div>Capitalisation</div>
              <div className="text-foreground font-mono tabular-nums">
                {formatSGD(client.profile.capitalisation_threshold)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
