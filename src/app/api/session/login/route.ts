import { NextResponse } from "next/server";

import { backendUrl, setSessionCookies, type SessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BackendToken = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: SessionUser & { last_login_at: string | null };
};

/**
 * Exchanges credentials for a session cookie.
 *
 * This is the only place the bearer token is ever handled, and it never leaves
 * the server: the response body carries the user, the token goes out as an
 * httpOnly cookie. The catch-all proxy refuses `/api/v1/auth/login` precisely so
 * that no other path can hand a token to the browser.
 */
export async function POST(request: Request) {
  let credentials: unknown;
  try {
    credentials = await request.json();
  } catch {
    return NextResponse.json({ message: "expected a JSON body" }, { status: 400 });
  }

  const { email, password } = (credentials ?? {}) as { email?: string; password?: string };
  if (!email || !password) {
    return NextResponse.json(
      { message: "enter an email address and a password" },
      { status: 400 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(backendUrl("/api/v1/auth/login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        message:
          "could not reach the accounting service. Check that the backend is running on " +
          (process.env.AIACCT_API_URL ?? "http://localhost:8000"),
      },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    // 401 here is deliberately the same message for an unknown email and a wrong
    // password, so the endpoint cannot be used to discover which addresses exist.
    // Pass the backend's wording straight through rather than composing our own.
    const body: unknown = await upstream.json().catch(() => null);
    const detail =
      body && typeof body === "object" && typeof (body as { detail?: unknown }).detail === "string"
        ? (body as { detail: string }).detail
        : "could not sign in";
    return NextResponse.json({ message: detail }, { status: upstream.status });
  }

  const token = (await upstream.json()) as BackendToken;
  const user: SessionUser = {
    id: token.user.id,
    name: token.user.name,
    email: token.user.email,
  };

  const response = NextResponse.json({ user });
  setSessionCookies(response, token.access_token, user, token.expires_in);
  return response;
}
