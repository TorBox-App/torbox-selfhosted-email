"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { CreateOrganizationForm } from "@/components/forms/create-organization-form";
import Loader from "@/components/loader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  const interval = searchParams.get("interval");
  const { data: session, isPending } = authClient.useSession();

  // Redirect to auth if not logged in
  if (!(isPending || session)) {
    router.push("/auth");
    return null;
  }

  if (isPending) {
    return <Loader fullScreen />;
  }

  // Handle successful org creation - pass plan and interval params to org onboarding
  const handleSuccess = (orgSlug: string) => {
    const params = new URLSearchParams();
    if (plan) params.set("plan", plan);
    if (interval) params.set("interval", interval);
    const url =
      params.toString() !== ""
        ? `/${orgSlug}/onboarding?${params.toString()}`
        : `/${orgSlug}/onboarding`;
    router.push(url);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create Your Organization</CardTitle>
          <CardDescription>
            Let's set up your workspace to get started with Wraps
          </CardDescription>
        </CardHeader>

        <CardContent>
          <CreateOrganizationForm onSuccess={handleSuccess} />
        </CardContent>
      </Card>
    </div>
  );
}
