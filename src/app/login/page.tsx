import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const raw = params.next;
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  // Only same-origin paths, so a crafted `?next=` cannot bounce someone offsite.
  const next = candidate && candidate.startsWith("/") && !candidate.startsWith("//")
    ? candidate
    : "/clients";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">AI Accounting Assistant</h1>
          <p className="text-muted-foreground text-sm">
            Sign in to review this month&rsquo;s books.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              {/* There is no registration endpoint behind a sign-up screen: a
                  firm decides who works on its clients' books. */}
              Accounts are set up by your firm. There is no sign-up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm next={next} />
          </CardContent>
        </Card>

        {process.env.NODE_ENV === "development" ? (
          <p className="text-muted-foreground text-center text-xs">
            Demo accounts: <code className="font-mono">weiling@firm.example</code> or{" "}
            <code className="font-mono">marcus@firm.example</code>, password{" "}
            <code className="font-mono">aiacct-demo-2026</code>
          </p>
        ) : null}
      </div>
    </main>
  );
}
