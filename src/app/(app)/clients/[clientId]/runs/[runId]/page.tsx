import { notFound } from "next/navigation";

import { RunWorkspace } from "./run-workspace";

export default async function RunPage({
  params,
}: PageProps<"/clients/[clientId]/runs/[runId]">) {
  const { clientId, runId } = await params;
  const run = Number(runId);
  if (!Number.isInteger(run) || run <= 0) notFound();

  return <RunWorkspace runId={run} clientId={Number(clientId)} />;
}
