"use client";

import { useEffect } from "react";
import { initGTM, initPostHog } from "@/utils/analytics";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initGTM();
    initPostHog();
  }, []);

  return <>{children}</>;
}
