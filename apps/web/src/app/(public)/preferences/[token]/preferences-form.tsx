"use client";

import { useState, useTransition } from "react";
import {
  resendConfirmation,
  unsubscribeGlobally,
  updatePreferences,
} from "./actions";

type Topic = {
  id: string;
  name: string;
  description: string | null;
  subscribed: boolean;
  pending: boolean;
  doubleOptIn: boolean;
};

type PreferencesFormProps = {
  token: string;
  contactId: string;
  organizationId: string;
  topics: Topic[];
  isGloballyUnsubscribed: boolean;
  hasMultipleChannels: boolean;
  preferredChannel: "email" | "sms" | null;
  brandColor: string;
  orgName?: string;
};

export function PreferencesForm({
  token,
  contactId,
  organizationId,
  topics,
  isGloballyUnsubscribed: initiallyUnsubscribed,
  hasMultipleChannels,
  preferredChannel: initialPreferredChannel,
  brandColor,
  orgName,
}: PreferencesFormProps) {
  const [isPending, startTransition] = useTransition();
  const [subscriptions, setSubscriptions] = useState<Record<string, boolean>>(
    () => {
      const initial: Record<string, boolean> = {};
      for (const topic of topics) {
        // Include both subscribed and pending as "checked"
        initial[topic.id] = topic.subscribed || topic.pending;
      }
      return initial;
    }
  );
  const [pendingTopics, setPendingTopics] = useState<Set<string>>(
    () => new Set(topics.filter((t) => t.pending).map((t) => t.id))
  );
  const [selectedChannel, setSelectedChannel] = useState<
    "email" | "sms" | null
  >(initialPreferredChannel);
  const [resendingFor, setResendingFor] = useState<string | null>(null);
  const [isGloballyUnsubscribed, setIsGloballyUnsubscribed] = useState(
    initiallyUnsubscribed
  );
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleTopicChange = (topicId: string, subscribed: boolean) => {
    setSubscriptions((prev) => ({ ...prev, [topicId]: subscribed }));
    // If unchecking, remove from pending set
    if (!subscribed) {
      setPendingTopics((prev) => {
        const next = new Set(prev);
        next.delete(topicId);
        return next;
      });
    }
  };

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await updatePreferences(
        token,
        contactId,
        organizationId,
        subscriptions,
        hasMultipleChannels ? selectedChannel : undefined
      );
      if (result.success) {
        // Update pending topics state
        if (result.pendingTopics) {
          setPendingTopics((prev) => {
            const next = new Set(prev);
            for (const topicId of result.pendingTopics!) {
              next.add(topicId);
            }
            return next;
          });
          setMessage({
            type: "success",
            text: `Preferences saved. Check your email to confirm ${result.pendingTopics.length === 1 ? "your subscription" : "your subscriptions"}.`,
          });
        } else {
          setMessage({
            type: "success",
            text: "Your preferences have been saved.",
          });
        }
      } else {
        setMessage({
          type: "error",
          text: result.error || "Something went wrong. Please try again.",
        });
      }
    });
  };

  const handleResendConfirmation = (topicId: string) => {
    setResendingFor(topicId);
    setMessage(null);
    startTransition(async () => {
      const result = await resendConfirmation(
        token,
        contactId,
        organizationId,
        topicId
      );
      setResendingFor(null);
      if (result.success) {
        setMessage({
          type: "success",
          text: "Confirmation email sent. Please check your inbox.",
        });
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to resend confirmation.",
        });
      }
    });
  };

  const handleUnsubscribeAll = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await unsubscribeGlobally(
        token,
        contactId,
        organizationId
      );
      if (result.success) {
        setIsGloballyUnsubscribed(true);
        setMessage({
          type: "success",
          text: "You've been unsubscribed from all emails.",
        });
      } else {
        setMessage({
          type: "error",
          text: result.error || "Something went wrong. Please try again.",
        });
      }
    });
  };

  if (isGloballyUnsubscribed) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
          <svg
            className="h-8 w-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
            />
          </svg>
        </div>
        <h2 className="mb-2 font-semibold text-gray-900 text-lg dark:text-white">
          You're Unsubscribed
        </h2>
        <p className="text-gray-500 text-sm dark:text-gray-400">
          You won't receive any more emails
          {orgName ? ` from ${orgName}` : ""}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status message */}
      {message && (
        <div
          className={`flex items-center gap-3 rounded-xl p-4 ${
            message.type === "success"
              ? "bg-green-50 text-green-800"
              : "bg-red-50 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <svg
              className="h-5 w-5 shrink-0 text-green-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          ) : (
            <svg
              className="h-5 w-5 shrink-0 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          )}
          <span className="text-sm">{message.text}</span>
        </div>
      )}

      {/* Topics list */}
      {topics.length > 0 ? (
        <div className="space-y-1">
          <h2 className="mb-3 font-medium text-gray-900 text-sm dark:text-white">
            Email Topics
          </h2>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {topics.map((topic) => {
              const isPendingConfirmation = pendingTopics.has(topic.id);
              const isResending = resendingFor === topic.id;

              return (
                <div className="p-4" key={topic.id}>
                  <label className="flex cursor-pointer items-start gap-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="relative flex h-5 items-center">
                      <input
                        checked={subscriptions[topic.id] ?? false}
                        className="peer h-4 w-4 cursor-pointer appearance-none rounded border-2 border-gray-300 transition-all checked:border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 dark:border-gray-600"
                        onChange={(e) =>
                          handleTopicChange(topic.id, e.target.checked)
                        }
                        style={{
                          backgroundColor: subscriptions[topic.id]
                            ? isPendingConfirmation
                              ? "#f59e0b" // Amber for pending
                              : brandColor
                            : undefined,
                        }}
                        type="checkbox"
                      />
                      {subscriptions[topic.id] && (
                        <svg
                          className="pointer-events-none absolute left-0 h-4 w-4 text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                          viewBox="0 0 24 24"
                        >
                          {isPendingConfirmation ? (
                            <path
                              d="M12 8v4m0 4h.01"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ) : (
                            <path
                              d="M5 13l4 4L19 7"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          )}
                        </svg>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm dark:text-white">
                          {topic.name}
                        </span>
                        {isPendingConfirmation && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 text-xs dark:bg-amber-900/30 dark:text-amber-400">
                            Pending confirmation
                          </span>
                        )}
                      </div>
                      {topic.description && (
                        <div className="mt-0.5 text-gray-500 text-sm dark:text-gray-400">
                          {topic.description}
                        </div>
                      )}
                    </div>
                  </label>

                  {/* Resend confirmation button for pending subscriptions */}
                  {isPendingConfirmation && (
                    <div className="mt-2 ml-9">
                      <button
                        className="rounded-md px-3 py-1.5 font-medium text-amber-700 text-xs transition-colors hover:bg-amber-50 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-900/30"
                        disabled={isPending || isResending}
                        onClick={() => handleResendConfirmation(topic.id)}
                        type="button"
                      >
                        {isResending
                          ? "Sending\u2026"
                          : "Resend confirmation email"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-gray-500 text-sm dark:text-gray-400">
            No email topics available.
          </p>
        </div>
      )}

      {/* Channel preference */}
      {hasMultipleChannels && (
        <div className="space-y-1">
          <h2 className="mb-3 font-medium text-gray-900 text-sm dark:text-white">
            Preferred Channel
          </h2>
          <p className="mb-3 text-gray-500 text-xs dark:text-gray-400">
            Choose how you'd prefer to be contacted.
          </p>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {(
              [
                { value: null, label: "No preference" },
                { value: "email", label: "Email" },
                { value: "sms", label: "SMS" },
              ] as const
            ).map((option) => (
              <label
                className="flex cursor-pointer items-center gap-4 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
                key={option.label}
              >
                <div className="relative flex h-5 items-center">
                  <input
                    checked={selectedChannel === option.value}
                    className="h-4 w-4 cursor-pointer appearance-none rounded-full border-2 border-gray-300 transition-all checked:border-transparent focus:outline-none focus:ring-2 focus:ring-offset-2 dark:border-gray-600"
                    name="preferredChannel"
                    onChange={() => setSelectedChannel(option.value)}
                    style={{
                      backgroundColor:
                        selectedChannel === option.value
                          ? brandColor
                          : undefined,
                    }}
                    type="radio"
                  />
                  {selectedChannel === option.value && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </div>
                <span className="font-medium text-gray-900 text-sm dark:text-white">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3 pt-2">
        {topics.length > 0 && (
          <button
            className="w-full rounded-xl px-4 py-3 font-medium text-sm text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
            disabled={isPending}
            onClick={handleSave}
            style={{ backgroundColor: brandColor }}
            type="button"
          >
            {isPending ? "Saving\u2026" : "Save Preferences"}
          </button>
        )}

        <button
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-medium text-gray-600 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:ring-offset-2 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          disabled={isPending}
          onClick={handleUnsubscribeAll}
          type="button"
        >
          Unsubscribe from All
        </button>
      </div>
    </div>
  );
}
