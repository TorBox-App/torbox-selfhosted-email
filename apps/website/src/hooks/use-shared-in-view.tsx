"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type InViewEntry = {
  isInView: boolean;
  hasBeenInView: boolean;
};

type InViewContextType = {
  observe: (
    element: Element,
    callback: (entry: InViewEntry) => void,
    options?: { once?: boolean; margin?: string }
  ) => () => void;
};

const InViewContext = createContext<InViewContextType | null>(null);

/**
 * Shared IntersectionObserver provider that consolidates multiple useInView hooks
 * into a single observer instance for better performance.
 */
export function InViewProvider({ children }: { children: React.ReactNode }) {
  const observersRef = useRef<Map<string, IntersectionObserver>>(new Map());
  const callbacksRef = useRef<
    Map<
      Element,
      {
        callback: (entry: InViewEntry) => void;
        once: boolean;
        hasBeenInView: boolean;
      }
    >
  >(new Map());

  const getObserver = useCallback((margin: string) => {
    const existing = observersRef.current.get(margin);
    if (existing) {
      return existing;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const data = callbacksRef.current.get(entry.target);
          if (data) {
            const isInView = entry.isIntersecting;
            const hasBeenInView = data.hasBeenInView || isInView;

            // Update hasBeenInView state
            if (isInView && !data.hasBeenInView) {
              data.hasBeenInView = true;
            }

            data.callback({ isInView, hasBeenInView });

            // If once mode and now in view, unobserve
            if (data.once && isInView) {
              observer.unobserve(entry.target);
              callbacksRef.current.delete(entry.target);
            }
          }
        }
      },
      { rootMargin: margin }
    );

    observersRef.current.set(margin, observer);
    return observer;
  }, []);

  const observe = useCallback(
    (
      element: Element,
      callback: (entry: InViewEntry) => void,
      options?: { once?: boolean; margin?: string }
    ) => {
      const margin = options?.margin ?? "-100px";
      const once = options?.once ?? true;
      const observer = getObserver(margin);

      callbacksRef.current.set(element, {
        callback,
        once,
        hasBeenInView: false,
      });
      observer.observe(element);

      return () => {
        observer.unobserve(element);
        callbacksRef.current.delete(element);
      };
    },
    [getObserver]
  );

  // Cleanup observers on unmount
  useEffect(
    () => () => {
      for (const observer of observersRef.current.values()) {
        observer.disconnect();
      }
      observersRef.current.clear();
      callbacksRef.current.clear();
    },
    []
  );

  const value = useMemo(() => ({ observe }), [observe]);

  return (
    <InViewContext.Provider value={value}>{children}</InViewContext.Provider>
  );
}

/**
 * Hook that uses the shared IntersectionObserver for better performance.
 * Falls back to individual observer if provider is not available.
 */
export function useSharedInView(options?: { once?: boolean; margin?: string }) {
  const context = useContext(InViewContext);
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<InViewEntry>({
    isInView: false,
    hasBeenInView: false,
  });

  const once = options?.once ?? true;
  const margin = options?.margin ?? "-100px";

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    // Use shared observer if available
    if (context) {
      return context.observe(element, setState, { once, margin });
    }

    // Fallback to individual observer
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isInView = entry.isIntersecting;
        setState((prev) => ({
          isInView,
          hasBeenInView: prev.hasBeenInView || isInView,
        }));

        if (once && isInView) {
          observer.disconnect();
        }
      },
      { rootMargin: margin }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [context, once, margin]);

  return { ref, ...state };
}
