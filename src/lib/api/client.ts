/**
 * The one place a network error becomes something the UI can show.
 *
 * The backend speaks three different error shapes, and messages written for a
 * person come back in all of them:
 *
 *   400 domain rule   `{"error": {"code": "invalid_request", "message": "..."}}`
 *   401/404/413/guard `{"detail": "..."}`
 *   422 validation    `{"detail": [{"loc": [...], "msg": "..."}]}`
 *   500               plain text, not JSON at all
 *
 * Messages like *"the parts total 900.00 but the bank line is 1000.00"* are more
 * useful than anything this layer would compose, so they are passed through
 * intact and shown directly.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /**
   * A missing allocation comes back as a 400, not a 404 - only client, run,
   * document and transaction lookups 404. Ask this rather than the status.
   */
  get isNotFound(): boolean {
    return this.status === 404 || /^no (allocation|such) /i.test(this.message);
  }
}

type ErrorEnvelope = {
  error?: { code?: string; message?: string };
  detail?: string | { loc?: (string | number)[]; msg?: string }[];
};

async function toApiError(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => "");

  let body: ErrorEnvelope | null = null;
  try {
    body = text ? (JSON.parse(text) as ErrorEnvelope) : null;
  } catch {
    // A 500 arrives as plain text.
    return new ApiError(response.status, text.trim() || response.statusText);
  }

  if (body?.error?.message) {
    // Pydantic's ValidationError subclasses ValueError, so a server-side model
    // failure can surface here as a multi-line dump. Keep the first line.
    const [first] = body.error.message.split("\n");
    return new ApiError(response.status, first || body.error.message, body.error.code ?? null);
  }

  if (typeof body?.detail === "string") {
    return new ApiError(response.status, body.detail);
  }

  if (Array.isArray(body?.detail)) {
    const message = body.detail
      .map((item) => {
        const where = (item.loc ?? []).filter((part) => part !== "body").join(".");
        return where ? `${where}: ${item.msg ?? "is not valid"}` : (item.msg ?? "is not valid");
      })
      .join("; ");
    return new ApiError(response.status, message || "the request was not valid");
  }

  return new ApiError(response.status, text.trim() || response.statusText);
}

/**
 * Builds a same-origin URL for the proxied backend. Because the session rides on
 * a cookie, URLs from here can be used directly as an `<iframe src>` or an
 * `<a download href>` - neither of which can carry an Authorization header.
 */
export function apiUrl(path: string): string {
  return `/api/v1${path.startsWith("/") ? path : `/${path}`}`;
}

function handleUnauthorized(): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === "/login") return;
  // The proxy has already dropped the cookie. There is no refresh endpoint, so
  // the only thing left to do is sign in again - keeping the current page as the
  // destination so the accountant lands back where they were.
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  // A hard navigation on purpose, not `router.push`: the session cookie has just
  // been dropped and the server layout has to re-read it. A soft transition would
  // keep the stale tree, and this runs outside React anyway.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `/login?next=${next}`;
}

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.body instanceof FormData ? {} : { "content-type": "application/json" }),
      ...init?.headers,
    },
  });

  if (response.status === 401) {
    handleUnauthorized();
    throw await toApiError(response);
  }

  if (!response.ok) throw await toApiError(response);

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Fetches a proxied endpoint as a Blob - used for downloads and previews. */
export async function fetchApiBlob(path: string): Promise<Blob> {
  const response = await fetch(apiUrl(path));
  if (response.status === 401) handleUnauthorized();
  if (!response.ok) throw await toApiError(response);
  return response.blob();
}
