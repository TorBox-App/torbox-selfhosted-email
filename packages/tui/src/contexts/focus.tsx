import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

type FocusContextValue = {
  inputActive: boolean;
  setInputActive: (active: boolean) => void;
};

const FocusContext = createContext<FocusContextValue>({
  inputActive: false,
  setInputActive: () => {},
});

export function FocusProvider({ children }: { children: ReactNode }) {
  const [inputActive, setInputActiveState] = useState(false);

  const setInputActive = useCallback((active: boolean) => {
    setInputActiveState(active);
  }, []);

  return (
    <FocusContext value={{ inputActive, setInputActive }}>
      {children}
    </FocusContext>
  );
}

export function useFocus() {
  return useContext(FocusContext);
}
