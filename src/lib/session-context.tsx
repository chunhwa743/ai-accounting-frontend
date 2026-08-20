"use client";

import { createContext, useContext } from "react";

import type { SessionUser } from "@/lib/session";

const SessionContext = createContext<SessionUser | null>(null);

/**
 * The signed-in user, read from a cookie on the server and handed down so the
 * shell can render a name without waiting on a request.
 */
export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSessionUser(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSessionUser must be used inside a SessionProvider");
  return user;
}
