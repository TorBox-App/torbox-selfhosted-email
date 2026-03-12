"use client";

import Link from "next/link";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ConnectAwsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  action: "send" | "publish" | "enable";
};

const descriptions: Record<ConnectAwsDialogProps["action"], string> = {
  send: "To send this broadcast, connect your AWS account first. Your emails are sent through your own AWS SES.",
  publish:
    "To publish this template to SES, connect your AWS account first. Templates are published to your own AWS.",
  enable:
    "To enable this workflow, connect your AWS account first. Workflows run on your own AWS infrastructure.",
};

export function ConnectAwsDialog({
  open,
  onOpenChange,
  orgSlug,
  action,
}: ConnectAwsDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Connect AWS to continue</AlertDialogTitle>
          <AlertDialogDescription>
            {descriptions[action]}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button asChild>
            <Link href={`/${orgSlug}/setup`}>Connect AWS</Link>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
