import { NextResponse, type NextRequest } from "next/server";

import { backendUrl, clearSessionCookies, TOKEN_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The events stream polls the backend for up to five minutes.
export const maxDuration = 320;

/**
 * Paths the browser may never reach through this proxy. `auth/login` is the only
 * endpoint that mints a bearer token; it is served by `/api/session/login`
 * instead, which keeps the token in an httpOnly cookie. Leaving it reachable
 * here would hand any script a way to obtain the raw token.
 */
const BLOCKED = new Set(["auth/login"]);

/** Request headers that describe *this* hop and must not be forwarded. */
const HOP_BY_HOP = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "cookie",
  "content-length",
  "accept-encoding",
  // undici refuses to send `Expect: 100-continue` at all. Some clients add it to
  // POSTs, and it describes this hop rather than the forwarded request.
  "expect",
]);

/** Upstream response headers worth passing back to the browser. */
const PASS_THROUGH = [
  "content-type",
  "content-disposition",
  "etag",
  "last-modified",
];

/**
 * Forwards everything under `/api/v1/*` to the FastAPI backend with the bearer
 * token attached.
 *
 * Two things fall out of doing it here rather than with a rewrite. The token
 * stays out of client JS, and because the session rides on a same-origin cookie
 * a document can be rendered with a plain `<iframe src>` and an export
 * downloaded with a plain `<a download>` - neither of which can carry an
 * Authorization header.
 */
async function proxyToBackend(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  const suffix = path.join("/");

  if (BLOCKED.has(suffix)) {
    return NextResponse.json(
      { detail: "sign in at /api/session/login - this proxy does not issue tokens" },
      { status: 403 },
    );
  }

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ detail: "not signed in" }, { status: 401 });
  }

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) headers.set(key, value);
  });
  headers.set("authorization", `Bearer ${token}`);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  // The incoming request's stream cannot be handed to `fetch` directly here -
  // undici rejects it - so the body is read into memory first. That is fine for
  // JSON, and tolerable for uploads: the backend caps a file at 50 MB anyway.
  const body = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(backendUrl(`/api/v1/${suffix}${request.nextUrl.search}`), {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
  } catch (reason) {
    // `fetch failed` on its own says nothing; the reason is always one level down.
    const chain: string[] = [];
    let current: unknown = reason;
    while (current instanceof Error && chain.length < 5) {
      const code = (current as { code?: unknown }).code;
      chain.push(`${current.name}: ${current.message}${code ? ` (${String(code)})` : ""}`);
      current = (current as { cause?: unknown }).cause;
    }
    const cause = chain.join(" <- ");
    console.error(`[proxy] ${request.method} /api/v1/${suffix} failed: ${cause}`);
    return NextResponse.json(
      {
        detail:
          "could not reach the accounting service. Check that the backend is running on " +
          (process.env.AIACCT_API_URL ?? "http://localhost:8000"),
        ...(process.env.NODE_ENV === "development" ? { cause } : {}),
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  for (const name of PASS_THROUGH) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  // Document content comes back as `attachment`, which makes a browser download
  // the file rather than render it. The review screen needs it beside the
  // transaction, so `?inline=1` asks for it inline instead. The backend ignores
  // the extra parameter; exports keep the attachment disposition they want.
  if (request.nextUrl.searchParams.get("inline") === "1") {
    responseHeaders.set("content-disposition", "inline");
  }

  // Server-sent events must not be buffered by anything between here and the
  // browser, or progress arrives all at once when the stream closes.
  if (upstream.headers.get("content-type")?.includes("text/event-stream")) {
    responseHeaders.set("cache-control", "no-cache, no-transform");
    responseHeaders.set("connection", "keep-alive");
    responseHeaders.set("x-accel-buffering", "no");
  } else {
    responseHeaders.set("cache-control", "no-store");
  }

  // A 401 can arrive mid-session: the backend re-reads the user row on every
  // request, so deactivating an account takes effect immediately rather than at
  // token expiry. Drop the cookie so the app stops pretending to be signed in.
  if (upstream.status === 401) {
    const body = await upstream.text();
    const response = new NextResponse(body || JSON.stringify({ detail: "session expired" }), {
      status: 401,
      headers: responseHeaders,
    });
    clearSessionCookies(response);
    return response;
  }

  // 204 and 304 must not carry a body.
  const bodyless = upstream.status === 204 || upstream.status === 304;
  return new NextResponse(bodyless ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxyToBackend;
export const POST = proxyToBackend;
export const PATCH = proxyToBackend;
export const PUT = proxyToBackend;
export const DELETE = proxyToBackend;
