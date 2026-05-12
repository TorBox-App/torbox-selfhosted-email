"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import posthog from "posthog-js";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    posthog.captureException(error, {
      $exception_source: "nextjs_error_boundary",
      error_digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="text-center">
        <h1 className="font-bold text-4xl">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">
          An unexpected error occurred. Our team has been notified.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-muted-foreground text-xs">
            Error ID: {error.digest}
          </p>
        )}
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Go Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
