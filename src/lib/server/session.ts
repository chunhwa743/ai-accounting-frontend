import "server-only";

import { cookies } from "next/headers";

import { parseSessionUser, TOKEN_COOKIE, USER_COOKIE, type SessionUser } from "@/lib/session";

/** Reads the session from the cookie store. Server Components and layouts only. */
export async function readToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(TOKEN_COOKIE)?.value ?? null;
}

export async function readUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return parseSessionUser(store.get(USER_COOKIE)?.value);
}
