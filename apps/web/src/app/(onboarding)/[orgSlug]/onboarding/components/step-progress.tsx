import {
  Stepper,
  StepperIndicator,
  StepperItem,
  StepperSeparator,
  StepperTrigger,
} from "@/components/ui/stepper";

type StepProgressProps = {
  steps: string[];
  currentStep: number;
};

export function StepProgress({ steps, currentStep }: StepProgressProps) {
  const totalSteps = steps.length;

  return (
    <Stepper
      value={currentStep}
      className="w-full items-start"
      role="navigation"
      aria-label="Onboarding progress"
    >
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isLast = index === steps.length - 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;
        const labelId = `step-label-${stepNumber}`;

        return (
          <StepperItem
            key={step}
            step={stepNumber}
            className={`!flex-col !items-center ${isLast ? "!flex-none" : ""}`}
          >
            <div className="flex w-full items-center">
              <StepperTrigger
                aria-labelledby={labelId}
                aria-current={isActive ? "step" : undefined}
              >
                <StepperIndicator className="size-11 text-sm shrink-0" />
                <span className="sr-only">
                  Step {stepNumber} of {totalSteps}, {step}
                  {isCompleted && ", completed"}
                  {isActive && ", current"}
                </span>
              </StepperTrigger>
              {!isLast && <StepperSeparator className="!m-0" />}
            </div>
            <span
              id={labelId}
              className={`mt-2 self-start translate-x-[calc(-50%+22px)] whitespace-nowrap font-medium text-xs ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {step}
            </span>
          </StepperItem>
        );
      })}
    </Stepper>
  );
}
