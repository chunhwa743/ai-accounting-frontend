import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { readUser } from "@/lib/server/session";
import { SessionProvider } from "@/lib/session-context";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await readUser();
  // `proxy.ts` normally catches this; the check is here so a page can never
  // render without a user even if the matcher is later changed.
  if (!user) redirect("/login");

  return (
    <SessionProvider user={user}>
      <AppHeader />
      <div className="mx-auto w-full max-w-[1600px] flex-1 px-6 py-6">{children}</div>
    </SessionProvider>
  );
}
