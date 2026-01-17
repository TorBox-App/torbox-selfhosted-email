"use client";

import posthog from "posthog-js";
import { createContext, type ReactNode, useContext, useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";

// Use ReturnType to infer the exact type from better-auth's useSession hook
type SessionContextType = ReturnType<typeof authClient.useSession>;

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const hasIdentified = useRef(false);

  // Identify returning users in PostHog when session is restored
  useEffect(() => {
    if (session.data?.user && !hasIdentified.current) {
      hasIdentified.current = true;
      posthog.identify(session.data.user.email, {
        email: session.data.user.email,
        name: session.data.user.name,
      });
    }
  }, [session.data?.user]);

  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
