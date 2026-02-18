"use client";

import { useRef } from "react";
import { type ProductsStatus, useProductsStore } from "@/stores/products-store";

type Props = {
  orgId: string;
  status: ProductsStatus;
};

const UNINITIALIZED = Symbol("uninitialized");

export function ProductsStatusHydrator({ orgId, status }: Props) {
  const setStatus = useProductsStore((s) => s.setStatus);
  const prevRef = useRef<
    { orgId: string; status: ProductsStatus } | typeof UNINITIALIZED
  >(UNINITIALIZED);

  // Hydrate on mount and when data changes (synchronously during render)
  if (
    prevRef.current === UNINITIALIZED ||
    prevRef.current.orgId !== orgId ||
    prevRef.current.status !== status
  ) {
    prevRef.current = { orgId, status };
    setStatus(orgId, status);
  }

  return null;
}
