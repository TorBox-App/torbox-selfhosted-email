"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
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

function DeviceCodeForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending: sessionPending } = useSession();

  const prefilled = searchParams.get("user_code") || "";
  const [code, setCode] = useState(prefilled);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If not logged in, redirect to auth page with callback
  useEffect(() => {
    if (sessionPending) return;
    if (!session?.user) {
      const callbackUrl = code ? `/device?user_code=${code}` : "/device";
      router.replace(
        `/auth?mode=signup&redirect=${encodeURIComponent(callbackUrl)}`
      );
    }
  }, [session, sessionPending, router, code]);

  const formatCode = (value: string): string => {
    const clean = value
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 8);
    if (clean.length > 4) {
      return `${clean.slice(0, 4)}-${clean.slice(4)}`;
    }
    return clean;
  };

  const handleCodeChange = (value: string) => {
    setCode(formatCode(value));
    setError(null);
  };

  const getRawCode = (formatted: string): string => formatted.replace(/-/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rawCode = getRawCode(code);
    if (rawCode.length !== 8) {
      setError("Please enter a valid 8-character code.");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error: verifyError } = await authClient.device({
        query: { user_code: rawCode },
      });

      if (verifyError) {
        setError("Invalid or expired code. Please try again.");
        return;
      }

      if (data?.status === "pending") {
        router.push(`/device/approve?user_code=${rawCode}`);
      } else {
        setError("This code has already been used or expired.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sessionPending || !session?.user) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Authorize Device</CardTitle>
        <CardDescription>Enter the code shown in your terminal</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="user_code">Device Code</Label>
            <Input
              autoComplete="off"
              autoFocus
              className="text-center font-mono text-lg tracking-widest"
              id="user_code"
              maxLength={9}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="XXXX-XXXX"
              type="text"
              value={code}
            />
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
          <Button
            disabled={isSubmitting || getRawCode(code).length !== 8}
            type="submit"
          >
            {isSubmitting ? "Verifying..." : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function DevicePage() {
  return (
    <Suspense>
      <DeviceCodeForm />
    </Suspense>
  );
}
