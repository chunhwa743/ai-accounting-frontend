/**
 * Session cookie names and writers.
 *
 * Deliberately free of `next/headers` and `server-only` so that `proxy.ts`, the
 * route handlers and the app shell can all share one definition. Anything that
 * needs to *read* the cookie store lives in `lib/server/session.ts`.
 */

/**
 * The bearer token, httpOnly so no client script can read it. The backend issues
 * one 12-hour token per sign-in and has no refresh endpoint, so its lifetime is
 * the session's lifetime.
 */
export const TOKEN_COOKIE = "aiacct_token";

/**
 * Who is signed in. Deliberately readable by the browser: it holds nothing
 * secret, and letting the app shell render the user's name from a cookie avoids
 * a round trip before the first paint.
 */
export const USER_COOKIE = "aiacct_user";

export type SessionUser = {
  id: number;
  name: string;
  email: string;
};

type CookieCarrier = {
  cookies: {
    set(args: {
      name: string;
      value: string;
      httpOnly?: boolean;
      sameSite?: "lax" | "strict" | "none";
      secure?: boolean;
      path?: string;
      maxAge?: number;
    }): unknown;
  };
};

function baseOptions(maxAge: number) {
  return {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function setSessionCookies(
  response: CookieCarrier,
  token: string,
  user: SessionUser,
  expiresInSeconds: number,
): void {
  const shared = baseOptions(expiresInSeconds);
  response.cookies.set({ ...shared, name: TOKEN_COOKIE, value: token, httpOnly: true });
  response.cookies.set({
    ...shared,
    name: USER_COOKIE,
    value: encodeURIComponent(JSON.stringify(user)),
    httpOnly: false,
  });
}

export function clearSessionCookies(response: CookieCarrier): void {
  const shared = baseOptions(0);
  response.cookies.set({ ...shared, name: TOKEN_COOKIE, value: "", httpOnly: true });
  response.cookies.set({ ...shared, name: USER_COOKIE, value: "", httpOnly: false });
}

export function parseSessionUser(raw: string | undefined): SessionUser | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as SessionUser).id === "number" &&
      typeof (parsed as SessionUser).name === "string" &&
      typeof (parsed as SessionUser).email === "string"
    ) {
      const { id, name, email } = parsed as SessionUser;
      return { id, name, email };
    }
  } catch {
    // A malformed cookie is treated as no session rather than an error.
  }
  return null;
}

export function backendUrl(path: string): string {
  const base = process.env.AIACCT_API_URL ?? "http://localhost:8000";
  return `${base.replace(/\/$/, "")}${path}`;
}
