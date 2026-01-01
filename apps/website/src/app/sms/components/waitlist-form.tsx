"use client";

import { useForm } from "@tanstack/react-form";
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type WaitlistFormProps = {
  product?: string;
  source?: string;
  className?: string;
  variant?: "inline" | "stacked";
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function WaitlistForm({
  product = "sms",
  source = "sms-page",
  className,
  variant = "inline",
}: WaitlistFormProps) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const form = useForm({
    defaultValues: {
      email: "",
    },
    validators: {
      onSubmit: ({ value }) => {
        if (!value.email) {
          return { fields: { email: "Email is required" } };
        }
        if (!isValidEmail(value.email)) {
          return { fields: { email: "Please enter a valid email" } };
        }
        return;
      },
    },
    onSubmit: async ({ value }) => {
      setStatus("loading");
      setErrorMessage("");

      try {
        const response = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: value.email,
            product,
            source,
            referrer:
              typeof document !== "undefined" ? document.referrer : null,
          }),
        });

        if (response.ok) {
          setStatus("success");
        } else {
          const data = await response.json();
          setErrorMessage(data.error || "Failed to join waitlist");
          setStatus("error");
        }
      } catch {
        setErrorMessage("Something went wrong. Please try again.");
        setStatus("error");
      }
    },
  });

  if (status === "success") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg bg-green-500/10 px-4 py-3 text-green-600 dark:text-green-400",
          className
        )}
      >
        <CheckCircle className="size-5 shrink-0" />
        <span className="font-medium text-sm">
          You're on the list! We'll notify you when SMS launches.
        </span>
      </div>
    );
  }

  return (
    <form
      className={cn(
        "w-full",
        variant === "inline" && "flex gap-2",
        variant === "stacked" && "flex flex-col gap-3",
        className
      )}
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => {
          const hasError =
            field.state.meta.isTouched &&
            field.state.meta.errors &&
            field.state.meta.errors.length > 0;

          return (
            <div className={cn("flex-1", variant === "stacked" && "w-full")}>
              <Input
                aria-invalid={hasError}
                className={cn(
                  variant === "inline" && "max-w-xs",
                  variant === "stacked" && "w-full"
                )}
                disabled={status === "loading"}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="you@company.com"
                type="email"
                value={field.state.value}
              />
              {hasError && (
                <p className="mt-1 text-destructive text-sm">
                  {String(field.state.meta.errors[0])}
                </p>
              )}
            </div>
          );
        }}
      </form.Field>

      <form.Subscribe
        selector={(state) => ({
          canSubmit: state.canSubmit,
          isSubmitting: state.isSubmitting,
        })}
      >
        {({ isSubmitting }) => (
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            disabled={status === "loading" || isSubmitting}
            type="submit"
          >
            {status === "loading" || isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Joining...</span>
              </>
            ) : (
              <>
                <span>Join Waitlist</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        )}
      </form.Subscribe>

      {status === "error" && errorMessage && (
        <p className="text-destructive text-sm">{errorMessage}</p>
      )}
    </form>
  );
}
