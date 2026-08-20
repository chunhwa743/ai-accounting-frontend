import { ClientMetricsView } from "./client-metrics";

export default async function MetricsPage({ params }: PageProps<"/clients/[clientId]/metrics">) {
  const { clientId } = await params;
  return <ClientMetricsView clientId={Number(clientId)} />;
}
