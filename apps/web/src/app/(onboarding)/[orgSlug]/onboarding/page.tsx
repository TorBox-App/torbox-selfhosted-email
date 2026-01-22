"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import Loader from "@/components/loader";
import { authClient } from "@/lib/auth-client";
import { AwsConnectStep } from "./components/aws-connect-step";
import { BillingStep } from "./components/billing-step";
import { DeployInfrastructureStep } from "./components/deploy-infrastructure-step";
import { StepProgress } from "./components/step-progress";
import { SuccessStep } from "./components/success-step";
import { WelcomeStep } from "./components/welcome-step";

const STEPS = [
  { id: 1, title: "Welcome", component: WelcomeStep },
  { id: 2, title: "Choose Plan", component: BillingStep },
  { id: 3, title: "Deploy", component: DeployInfrastructureStep },
  { id: 4, title: "Connect AWS", component: AwsConnectStep },
  { id: 5, title: "Success", component: SuccessStep },
];

type OnboardingPageProps = {
  params: Promise<{ orgSlug: string }>;
};

export default function OnboardingPage({ params }: OnboardingPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();
  const [orgSlug, setOrgSlug] = useState<string | null>(null);

  // Get step from URL or localStorage
  const [currentStep, setCurrentStep] = useState(1);
  const [isInitialized, setIsInitialized] = useState(false);

  // Get organization details
  const { data: organizations } = authClient.useListOrganizations();

  // Get orgSlug from route params
  useEffect(() => {
    params.then((p) => setOrgSlug(p.orgSlug));
  }, [params]);

  // Initialize step from URL or localStorage
  useEffect(() => {
    if (!orgSlug) {
      return;
    }

    const stepParam = searchParams.get("step");
    if (stepParam) {
      const step = Number.parseInt(stepParam, 10);
      if (!Number.isNaN(step) && step >= 1 && step <= STEPS.length) {
        setCurrentStep(step);
        setIsInitialized(true);
        return;
      }
    }

    const savedStep = localStorage.getItem(`onboarding_step_${orgSlug}`);
    if (savedStep) {
      const step = Number.parseInt(savedStep, 10);
      if (!Number.isNaN(step) && step >= 1 && step <= STEPS.length) {
        setCurrentStep(step);
      }
    }
    setIsInitialized(true);
  }, [orgSlug, searchParams]);

  // Store plan and billing interval preferences in localStorage
  useEffect(() => {
    if (!orgSlug) {
      return;
    }

    const planParam = searchParams.get("plan");
    const intervalParam = searchParams.get("interval");

    // Only store if params exist in URL (coming from signup)
    if (planParam) {
      localStorage.setItem(`onboarding_plan_${orgSlug}`, planParam);
    }
    if (intervalParam) {
      localStorage.setItem(`onboarding_interval_${orgSlug}`, intervalParam);
    }
  }, [orgSlug, searchParams]);

  // Handle returning from Stripe checkout with subscribed=true
  const hasShownSubscribedToast = useRef(false);
  useEffect(() => {
    if (!isInitialized || hasShownSubscribedToast.current) {
      return;
    }

    const subscribed = searchParams.get("subscribed");
    if (subscribed === "true") {
      hasShownSubscribedToast.current = true;
      toast.success(
        "Payment successful! Let's set up your AWS infrastructure."
      );
      // Advance to Deploy Infrastructure step (step 3) if on billing step
      if (currentStep === 2) {
        setCurrentStep(3);
      }
    }
  }, [searchParams, isInitialized, currentStep]);

  // Save step to localStorage
  useEffect(() => {
    if (orgSlug && isInitialized) {
      localStorage.setItem(
        `onboarding_step_${orgSlug}`,
        currentStep.toString()
      );
    }
  }, [currentStep, orgSlug, isInitialized]);

  // Check if onboarding is already completed
  const { data: onboardingStatus } = useQuery({
    queryKey: ["onboarding-status", orgSlug],
    queryFn: async () => {
      if (!orgSlug) {
        return null;
      }
      const res = await fetch(`/api/${orgSlug}/onboarding/status`);
      if (!res.ok) {
        return null;
      }
      return res.json();
    },
    enabled: !!orgSlug,
  });

  // Skip billing step if user already has an active subscription
  const hasSkippedBilling = useRef(false);
  useEffect(() => {
    if (
      !isInitialized ||
      !onboardingStatus ||
      hasSkippedBilling.current ||
      hasShownSubscribedToast.current
    ) {
      return;
    }

    // If user has active subscription and is on billing step (step 2), skip to deploy step
    if (onboardingStatus.hasActiveSubscription && currentStep === 2) {
      hasSkippedBilling.current = true;
      setCurrentStep(3);
    }
  }, [isInitialized, onboardingStatus, currentStep]);

  // Find the organization that matches the orgSlug
  const currentOrg = organizations?.find(
    (org) => org.slug === orgSlug || org.id === orgSlug
  );

  // Track onboarding started (only once per session)
  const hasTrackedStart = useRef(false);
  useEffect(() => {
    if (isInitialized && currentOrg && !hasTrackedStart.current) {
      hasTrackedStart.current = true;
      posthog.capture("onboarding_started", {
        organization_id: currentOrg.id,
        initial_step: currentStep,
      });
    }
  }, [isInitialized, currentOrg, currentStep]);

  // Track step views
  const previousStep = useRef<number | null>(null);
  useEffect(() => {
    if (isInitialized && currentOrg && previousStep.current !== currentStep) {
      previousStep.current = currentStep;
      posthog.capture("onboarding_step_viewed", {
        step: currentStep,
        step_name: STEPS[currentStep - 1]?.title,
        organization_id: currentOrg.id,
      });
    }
  }, [isInitialized, currentOrg, currentStep]);

  // Handle redirects in useEffect to avoid setState during render
  // Use refs to prevent multiple redirects
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;
    if (onboardingStatus?.completed && orgSlug) {
      hasRedirected.current = true;
      router.push(`/${orgSlug}/emails`);
    }
  }, [onboardingStatus, router, orgSlug]);

  useEffect(() => {
    if (hasRedirected.current) return;
    // Only redirect if auth check is complete and there's no session
    if (!isPending && session === null) {
      hasRedirected.current = true;
      router.push("/auth");
    }
  }, [isPending, session, router]);

  useEffect(() => {
    if (hasRedirected.current) return;
    // Only redirect if organizations have loaded AND org is not found
    // organizations will be an array (possibly empty) when loaded, undefined when loading
    if (organizations !== undefined && orgSlug && !currentOrg) {
      hasRedirected.current = true;
      router.push("/");
    }
  }, [currentOrg, organizations, orgSlug, router]);

  if (isPending || !isInitialized || !orgSlug) {
    return <Loader fullScreen />;
  }

  if (!session) {
    return <Loader fullScreen />;
  }

  if (!currentOrg) {
    // Still loading organizations or redirecting
    return <Loader fullScreen />;
  }

  const CurrentStepComponent = STEPS[currentStep - 1].component;

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    // Skip current step and move to the next one
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    } else {
      // If on last step, skip to emails without marking complete
      router.push(`/${orgSlug}/emails`);
    }
  };

  // Called when AWS account is already connected (CloudFormation deployment)
  // This skips the AwsConnectStep and goes directly to Success
  const handleConnected = () => {
    // Skip to Success step (step 5)
    setCurrentStep(5);
  };

  const handleComplete = async () => {
    // Mark onboarding complete and redirect to emails
    await fetch(`/api/${orgSlug}/onboarding/complete`, {
      method: "POST",
    });

    // Invalidate the onboarding status query to refetch
    await queryClient.invalidateQueries({
      queryKey: ["onboarding-status", orgSlug],
    });

    // Clear localStorage
    localStorage.removeItem(`onboarding_step_${orgSlug}`);
    localStorage.removeItem(`onboarding_plan_${orgSlug}`);
    localStorage.removeItem(`onboarding_interval_${orgSlug}`);

    // Track final completion in the main page as well for redundancy
    if (currentOrg) {
      posthog.capture("onboarding_flow_completed", {
        organization_id: currentOrg.id,
        final_step: currentStep,
      });
    }

    router.push(`/${orgSlug}/emails`);
  };

  return (
    <div className="space-y-8">
      {/* Progress Indicator */}
      <StepProgress
        currentStep={currentStep}
        steps={STEPS.map((s) => s.title)}
      />

      {/* Current Step Content */}
      <CurrentStepComponent
        onBack={handleBack}
        onComplete={handleComplete}
        onConnected={handleConnected}
        onNext={handleNext}
        onSkip={handleSkip}
        organizationId={currentOrg.id}
      />
    </div>
  );
}
