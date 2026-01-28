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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { useState } from "react";
import { toast } from "sonner";

export function DeleteAccount() {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeleteAccount() {
    setIsDeleting(true);
    try {
      const { error } = await authClient.deleteUser();
      if (error) {
        toast.error(error.message || "Failed to delete account");
        return;
      }
      window.location.href = "/";
    } catch {
      toast.error("Failed to delete account. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Danger Zone</CardTitle>
        <CardDescription>Irreversible and destructive actions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-semibold">Delete Account</h4>
            <p className="text-muted-foreground text-sm">
              Permanently delete your account and all associated data.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive">
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  your account and remove all associated data from our servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={handleDeleteAccount}
                >
                  {isDeleting ? "Deleting..." : "Delete Account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
