import { LearnedRules } from "./learned-rules";

export default async function RulesPage({ params }: PageProps<"/clients/[clientId]/rules">) {
  const { clientId } = await params;
  return <LearnedRules clientId={Number(clientId)} />;
}
