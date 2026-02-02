import { useInitWizard } from "../../../hooks/use-init-wizard";
import type { AccountData, InitConfig, InitStep } from "../../../types";
import { ConfigStep } from "./config-step";
import { DeployStep } from "./deploy-step";
import { FeaturesStep } from "./features-step";
import { ReviewStep } from "./review-step";
import { WelcomeStep } from "./welcome-step";

const STEP_ORDER: InitStep[] = [
  "welcome",
  "config",
  "features",
  "review",
  "deploy",
];

interface EmailInitProps {
  data: AccountData;
  onBack: () => void;
  onComplete: () => void;
}

export function EmailInit({ data, onBack, onComplete }: EmailInitProps) {
  const { step, config, updateConfig, goNext, goBack } = useInitWizard();

  const stepIndex = STEP_ORDER.indexOf(step);

  const handleBack = () => {
    if (!goBack()) {
      onBack();
    }
  };

  switch (step) {
    case "welcome":
      return (
        <WelcomeStep data={data} onBack={onBack} onNext={goNext} stepIndex={stepIndex} />
      );

    case "config":
      return (
        <ConfigStep
          config={config}
          onBack={handleBack}
          onNext={(partial) => {
            updateConfig(partial);
            goNext();
          }}
          stepIndex={stepIndex}
        />
      );

    case "features":
      return (
        <FeaturesStep
          config={config}
          onBack={handleBack}
          onNext={(partial) => {
            updateConfig(partial);
            goNext();
          }}
          stepIndex={stepIndex}
        />
      );

    case "review":
      return (
        <ReviewStep
          accountId={data.accountId}
          config={config as InitConfig}
          onBack={handleBack}
          onConfirm={goNext}
          stepIndex={stepIndex}
        />
      );

    case "deploy":
      return (
        <DeployStep
          config={config as InitConfig}
          onBack={handleBack}
          onComplete={onComplete}
          stepIndex={stepIndex}
        />
      );
  }
}
