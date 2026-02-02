import { useCallback, useState } from "react";
import type { Route } from "../types";

export function useRouter(initial: Route = { view: "dashboard" }) {
  const [route, setRoute] = useState<Route>(initial);
  const [, setHistory] = useState<Route[]>([]);

  const navigate = useCallback((next: Route) => {
    setRoute((current) => {
      setHistory((prev) => [...prev, current]);
      return next;
    });
  }, []);

  const back = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next.pop()!;
      setRoute(last);
      return next;
    });
  }, []);

  return { route, navigate, back };
}
