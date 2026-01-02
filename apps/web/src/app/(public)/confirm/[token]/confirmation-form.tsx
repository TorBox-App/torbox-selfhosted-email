"use client";

import { useState } from "react";

import { confirmSubscription } from "./actions";

interface ConfirmationFormProps {
  token: string;
  brandColor: string;
}

export function ConfirmationForm({ token, brandColor }: ConfirmationFormProps) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setStatus("loading");
    setError(null);

    const result = await confirmSubscription(token);

    if (result.success) {
      setStatus("success");
    } else {
      setStatus("error");
      setError(result.error);
    }
  }

  if (status === "success") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
          <svg
            className="h-5 w-5 text-green-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M5 13l4 4L19 7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
        </div>
        <h3 className="mb-1 font-medium text-gray-900">
          Subscription Confirmed!
        </h3>
        <p className="text-gray-500 text-sm">
          You're now subscribed and will receive updates.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        className="w-full rounded-lg px-4 py-3 font-medium text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={status === "loading"}
        onClick={handleConfirm}
        style={{ backgroundColor: brandColor }}
        type="button"
      >
        {status === "loading" ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                fill="currentColor"
              />
            </svg>
            Confirming...
          </span>
        ) : (
          "Confirm Subscription"
        )}
      </button>

      <p className="mt-4 text-center text-gray-400 text-xs">
        By confirming, you agree to receive emails for this topic.
      </p>
    </div>
  );
}
