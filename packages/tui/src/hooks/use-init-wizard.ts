import { useCallback, useState } from "react";
import type { InitConfig, InitStep } from "../types";

const STEP_ORDER: InitStep[] = [
  "welcome",
  "config",
  "features",
  "review",
  "deploy",
];

export interface UseInitWizardReturn {
  step: InitStep;
  config: Partial<InitConfig>;
  updateConfig: (partial: Partial<InitConfig>) => void;
  goToStep: (step: InitStep) => void;
  goNext: () => void;
  goBack: () => boolean;
}

export function useInitWizard(): UseInitWizardReturn {
  const [step, setStep] = useState<InitStep>("welcome");
  const [config, setConfig] = useState<Partial<InitConfig>>({});

  const updateConfig = useCallback((partial: Partial<InitConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const goToStep = useCallback((next: InitStep) => {
    setStep(next);
  }, []);

  const goNext = useCallback(() => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[idx + 1]!);
    }
  }, [step]);

  const goBack = useCallback((): boolean => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) {
      setStep(STEP_ORDER[idx - 1]!);
      return true;
    }
    return false;
  }, [step]);

  return { step, config, updateConfig, goToStep, goNext, goBack };
}
