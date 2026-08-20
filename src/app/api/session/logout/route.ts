import { NextResponse } from "next/server";

import { clearSessionCookies } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The backend issues stateless JWTs with no revocation endpoint, so signing out
 * is entirely a matter of dropping the cookie. The token stays technically valid
 * until it expires; nothing holds it once this returns.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
