import { RunsOverview } from "./runs-overview";

export default async function ClientPage({ params }: PageProps<"/clients/[clientId]">) {
  const { clientId } = await params;
  return <RunsOverview clientId={Number(clientId)} />;
}
