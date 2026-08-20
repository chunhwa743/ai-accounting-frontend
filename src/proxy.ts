import { NextResponse, type NextRequest } from "next/server";

import { TOKEN_COOKIE } from "@/lib/session";

/**
 * Gates the pages. API routes are deliberately excluded by the matcher: a
 * fetch that has lost its session should come back as a 401 the client can
 * handle, not as a 200 containing the login page's HTML.
 *
 * This is a convenience, not the security boundary - the backend authenticates
 * every request on its own, and the proxy route refuses to forward without a
 * token.
 */
export function proxy(request: NextRequest) {
  const signedIn = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);
  const { pathname, search } = request.nextUrl;
  const onLoginPage = pathname === "/login";

  if (!signedIn && !onLoginPage) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (signedIn && onLoginPage) {
    return NextResponse.redirect(new URL("/clients", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
