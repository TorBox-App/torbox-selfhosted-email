import { CloudIcon, PencilRulerIcon } from "lucide-react";
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ChoosePathStepProps = {
  onNext: () => void;
  organizationId: string;
  orgSlug?: string;
};

export function ChoosePathStep({
  onNext,
  organizationId,
  orgSlug: orgSlugProp,
}: ChoosePathStepProps) {
  const handlePath = (path: "start_building" | "connect_aws") => {
    // Persist path choice to survive Stripe redirect
    const orgSlug = orgSlugProp ?? window.location.pathname.split("/")[1] ?? "";
    localStorage.setItem(`onboarding_path_${orgSlug}`, path);

    posthog.capture("onboarding_path_chosen", {
      path,
      step: 3,
      step_name: "Choose Path",
      organization_id: organizationId,
    });
    posthog.capture("onboarding_step_completed", {
      step: 3,
      step_name: "Choose Path",
      organization_id: organizationId,
    });
    onNext();
  };

  return (
    <Card>
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-3xl">Welcome to Wraps!</CardTitle>
        <CardDescription className="text-base">
          How would you like to get started?
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="flex flex-col items-center space-y-3 p-6 text-center">
            <PencilRulerIcon className="h-10 w-10 text-primary" />
            <h3 className="font-semibold text-lg">Start building</h3>
            <p className="text-muted-foreground text-sm">
              Create templates, build workflows, add contacts — everything
              except sending. Connect AWS later when you're ready.
            </p>
            <Button
              className="mt-auto w-full"
              onClick={() => handlePath("start_building")}
              size="lg"
            >
              Explore the product
            </Button>
          </Card>

          <Card className="flex flex-col items-center space-y-3 p-6 text-center">
            <CloudIcon className="h-10 w-10 text-primary" />
            <h3 className="font-semibold text-lg">Connect AWS now</h3>
            <p className="text-muted-foreground text-sm">
              Set up your AWS infrastructure and start sending emails in
              minutes. Best if you already have an AWS account.
            </p>
            <Button
              className="mt-auto w-full"
              onClick={() => handlePath("connect_aws")}
              size="lg"
              variant="outline"
            >
              Set up infrastructure
            </Button>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
