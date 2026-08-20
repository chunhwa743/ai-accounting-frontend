import { notFound } from "next/navigation";

import { ClientBanner } from "@/components/domain/client-banner";

export default async function ClientLayout({
  params,
  children,
}: LayoutProps<"/clients/[clientId]">) {
  const { clientId } = await params;
  const id = Number(clientId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  return (
    <div className="space-y-6">
      <ClientBanner clientId={id} />
      {children}
    </div>
  );
}
