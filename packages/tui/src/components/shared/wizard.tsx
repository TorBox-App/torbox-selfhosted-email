import { type ReactNode, useCallback, useState } from "react";

export interface WizardStepProps {
  onNext: (data: Record<string, unknown>) => void;
  onBack: () => void;
  accumulated: Record<string, unknown>;
}

export interface WizardStep {
  title: string;
  render: (props: WizardStepProps) => ReactNode;
}

interface WizardProps {
  steps: WizardStep[];
  onComplete: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

export function Wizard({ steps, onComplete, onCancel }: WizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [accumulated, setAccumulated] = useState<Record<string, unknown>>({});

  const onNext = useCallback(
    (data: Record<string, unknown>) => {
      const merged = { ...accumulated, ...data };
      setAccumulated(merged);

      if (currentStep >= steps.length - 1) {
        onComplete(merged);
      } else {
        setCurrentStep((s) => s + 1);
      }
    },
    [accumulated, currentStep, steps.length, onComplete]
  );

  const onBack = useCallback(() => {
    if (currentStep === 0) {
      onCancel();
    } else {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep, onCancel]);

  const step = steps[currentStep];
  if (!step) return null;

  return (
    <box flexDirection="column" height="100%" width="100%">
      <box flexDirection="row" gap={2} paddingLeft={1}>
        <text fg="#00AAFF">
          <b>{step.title}</b>
        </text>
        <text fg="#666666">{`Step ${currentStep + 1} of ${steps.length}`}</text>
      </box>
      <text fg="#444444">{" " + "─".repeat(60)}</text>
      <box flexGrow={1} width="100%">
        {step.render({ onNext, onBack, accumulated })}
      </box>
    </box>
  );
}
