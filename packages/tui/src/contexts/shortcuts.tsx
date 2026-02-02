import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import type { Shortcut } from "../types";

interface ShortcutsContextValue {
  overrides: Shortcut[] | null;
  setShortcuts: (shortcuts: Shortcut[]) => void;
  clearShortcuts: () => void;
}

const ShortcutsContext = createContext<ShortcutsContextValue>({
  overrides: null,
  setShortcuts: () => {},
  clearShortcuts: () => {},
});

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Shortcut[] | null>(null);

  const setShortcuts = useCallback((shortcuts: Shortcut[]) => {
    setOverrides(shortcuts);
  }, []);

  const clearShortcuts = useCallback(() => {
    setOverrides(null);
  }, []);

  return (
    <ShortcutsContext value={{ overrides, setShortcuts, clearShortcuts }}>
      {children}
    </ShortcutsContext>
  );
}

export function useShortcuts() {
  return useContext(ShortcutsContext);
}
