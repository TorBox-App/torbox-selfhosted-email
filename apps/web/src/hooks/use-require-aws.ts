"use client";

import { useState } from "react";
import { useProductsStore } from "@/stores/products-store";

export function useRequireAws(orgSlug: string) {
  const hasAwsAccounts = useProductsStore((s) => s.status?.hasAwsAccounts);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "send" | "publish" | "enable" | null
  >(null);

  const requireAws = (action: "send" | "publish" | "enable"): boolean => {
    if (hasAwsAccounts) return true;
    setPendingAction(action);
    setDialogOpen(true);
    return false;
  };

  return { requireAws, dialogOpen, setDialogOpen, pendingAction, orgSlug };
}
