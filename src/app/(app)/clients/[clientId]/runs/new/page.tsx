import { NewRun } from "./new-run";

export default async function NewRunPage({
  params,
}: PageProps<"/clients/[clientId]/runs/new">) {
  const { clientId } = await params;
  return <NewRun clientId={Number(clientId)} />;
}
