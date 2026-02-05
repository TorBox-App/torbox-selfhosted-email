"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createOrganizationAction } from "@/actions/organizations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";
import { generateSlug } from "@/lib/utils/slug";

type PageState = "approve" | "create-org" | "success";

function DeviceApproveForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending: sessionPending } = useSession();

  const userCode = searchParams.get("user_code") || "";
  const [state, setState] = useState<PageState>("approve");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Org creation state
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [autoSlug, setAutoSlug] = useState(true);
  const [createdOrgName, setCreatedOrgName] = useState("");

  // If not logged in, redirect
  useEffect(() => {
    if (sessionPending) return;
    if (!session?.user) {
      router.replace(
        `/auth?mode=signup&redirect=${encodeURIComponent(`/device?user_code=${userCode}`)}`
      );
    }
  }, [session, sessionPending, router, userCode]);

  // If no code, go back
  useEffect(() => {
    if (!userCode) {
      router.replace("/device");
    }
  }, [userCode, router]);

  const formatCode = (code: string): string => {
    if (code.length > 4) {
      return `${code.slice(0, 4)}-${code.slice(4)}`;
    }
    return code;
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const { error: approveError } = await authClient.device.approve({
        userCode,
      });

      if (approveError) {
        const errorMsg =
          (approveError as any).error === "expired_token"
            ? "This code has expired. Please run `wraps auth login` again."
            : "Failed to approve. The code may be invalid or expired.";
        setError(errorMsg);
        setIsSubmitting(false);
        return;
      }

      // Check if user has orgs
      const { data: orgs } = await authClient.organization.list();

      if (orgs && orgs.length > 0) {
        setState("success");
      } else {
        setState("create-org");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeny = async () => {
    setIsSubmitting(true);

    try {
      await authClient.device.deny({ userCode });
    } catch {
      // Even if deny fails, redirect away
    }

    router.replace("/");
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createOrganizationAction({
        name: orgName,
        slug: orgSlug || undefined,
      });

      if (result.success) {
        setCreatedOrgName(result.organization.name);
        setState("success");
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to create organization. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    if (autoSlug) {
      setOrgSlug(generateSlug(value));
    }
  };

  if (sessionPending || !session?.user || !userCode) {
    return null;
  }

  if (state === "success") {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">You're all set!</CardTitle>
          <CardDescription>Return to your terminal to continue</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-muted-foreground text-center text-sm">
            Your CLI session has been authorized
            {createdOrgName ? ` for ${createdOrgName}` : ""}. You can close this
            tab.
          </p>
          <Button onClick={() => router.push("/")} variant="outline">
            Open Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state === "create-org") {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create Organization</CardTitle>
          <CardDescription>
            Set up your organization to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleCreateOrg}>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                autoFocus
                id="org-name"
                onChange={(e) => handleOrgNameChange(e.target.value)}
                placeholder="Acme Inc."
                required
                type="text"
                value={orgName}
              />
              <p className="text-muted-foreground text-xs">
                The name of your organization or company
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="org-slug">URL Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  wraps.dev/
                </span>
                <Input
                  id="org-slug"
                  onChange={(e) => {
                    setOrgSlug(e.target.value);
                    setAutoSlug(false);
                  }}
                  placeholder="acme-inc"
                  type="text"
                  value={orgSlug}
                />
              </div>
            </div>
            <Button disabled={isSubmitting || !orgName} type="submit">
              {isSubmitting ? "Creating..." : "Create Organization"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // Default: approve state
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Authorize CLI</CardTitle>
        <CardDescription>
          A CLI session is requesting access to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        <div className="rounded-lg border bg-muted/50 p-4 text-center">
          <p className="text-muted-foreground mb-1 text-xs">
            Confirm this matches your terminal
          </p>
          <p className="font-mono text-2xl tracking-widest">
            {formatCode(userCode)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={isSubmitting}
            onClick={handleApprove}
          >
            {isSubmitting ? "Approving..." : "Approve"}
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={handleDeny}
            variant="outline"
          >
            Deny
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DeviceApprovePage() {
  return (
    <Suspense>
      <DeviceApproveForm />
    </Suspense>
  );
}
