"use client";

import { useEffect, useRef } from "react";
import { type ProductsStatus, useProductsStore } from "@/stores/products-store";

type Props = {
  orgId: string;
  status: ProductsStatus;
};

export function ProductsStatusHydrator({ orgId, status }: Props) {
  const setStatus = useProductsStore((s) => s.setStatus);
  const hydrated = useRef(false);

  // Hydrate on mount and when data changes
  if (!hydrated.current) {
    setStatus(orgId, status);
    hydrated.current = true;
  }

  useEffect(() => {
    setStatus(orgId, status);
  }, [orgId, status, setStatus]);

  return null;
}
