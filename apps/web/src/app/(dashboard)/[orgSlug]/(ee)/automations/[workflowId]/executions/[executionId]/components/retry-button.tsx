"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@wraps/ui/components/ui/alert-dialog";
import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { retryWorkflowExecution } from "@/actions/(ee)/workflows";
import { Button } from "@/components/ui/button";

// Step types that deliver a message to the contact. Retrying these re-sends,
// so we confirm before firing to avoid an accidental duplicate delivery.
const SENDING_STEP_TYPES = new Set(["send_email", "send_sms"]);

export function RetryButton({
  executionId,
  organizationId,
  errorStepType,
  contactEmail,
}: {
  executionId: string;
  organizationId: string;
  errorStepType?: string;
  contactEmail?: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleRetry() {
    startTransition(async () => {
      const result = await retryWorkflowExecution(executionId, organizationId);
      if (result.success) {
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to retry execution");
      }
    });
  }

  // Non-sending steps (delay, condition, webhook, …) have no delivery side
  // effect, so retry immediately without a confirmation prompt.
  if (!(errorStepType && SENDING_STEP_TYPES.has(errorStepType))) {
    return (
      <Button disabled={isPending} onClick={handleRetry} size="sm">
        <RotateCcw className="mr-2 h-4 w-4" />
        {isPending ? "Retrying..." : "Retry"}
      </Button>
    );
  }

  const recipient = contactEmail ?? "this contact";

  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <AlertDialogTrigger asChild>
        <Button size="sm">
          <RotateCcw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Re-send this message?</AlertDialogTitle>
          <AlertDialogDescription>
            Retrying this step will re-send to {recipient}. If the original
            message was already delivered, they may receive it again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              handleRetry();
            }}
          >
            {isPending ? "Retrying..." : "Re-send"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
