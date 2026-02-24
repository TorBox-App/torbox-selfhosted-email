"use client";

import { useEffect } from "react";
import { type ProductsStatus, useProductsStore } from "@/stores/products-store";

type Props = {
  orgId: string;
  status: ProductsStatus;
};

export function ProductsStatusHydrator({ orgId, status }: Props) {
  const setStatus = useProductsStore((s) => s.setStatus);

  useEffect(() => {
    setStatus(orgId, status);
  }, [orgId, status, setStatus]);

  return null;
}
