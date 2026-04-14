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
} from "@wraps/ui/components/ui/alert-dialog";

type SendConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  recipientCount: number;
  variant: "send" | "schedule";
  scheduledDate?: Date;
  loading?: boolean;
};

export function SendConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  recipientCount,
  variant,
  scheduledDate,
  loading,
}: SendConfirmDialogProps) {
  const formattedCount = recipientCount.toLocaleString();

  const scheduleDescription = scheduledDate
    ? `This will schedule emails to ${formattedCount} contacts for ${scheduledDate.toLocaleDateString(undefined, { dateStyle: "medium" })} at ${scheduledDate.toLocaleTimeString(undefined, { timeStyle: "short" })}.`
    : `This will schedule emails to ${formattedCount} contacts.`;

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {variant === "schedule" ? "Confirm schedule" : "Confirm send"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {variant === "schedule"
              ? scheduleDescription
              : `This will immediately send emails to ${formattedCount} contacts. This action cannot be undone.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {loading
              ? variant === "schedule"
                ? "Scheduling..."
                : "Sending..."
              : variant === "schedule"
                ? "Schedule"
                : "Send now"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
