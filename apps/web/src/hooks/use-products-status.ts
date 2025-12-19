import type {
  ProductsStatusResponse,
  ProductStatus,
} from "@/app/api/[orgSlug]/products/route";
import { useQuery } from "@tanstack/react-query";

async function fetchProductsStatus(
  orgSlug: string
): Promise<ProductsStatusResponse> {
  const response = await fetch(`/api/${orgSlug}/products`);

  if (!response.ok) {
    throw new Error("Failed to fetch products status");
  }

  return response.json();
}

export function useProductsStatus(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ["products-status", orgSlug],
    queryFn: () => fetchProductsStatus(orgSlug!),
    enabled: !!orgSlug,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useProductStatus(
  orgSlug: string | undefined,
  productId: "email" | "sms"
): {
  product: ProductStatus | undefined;
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useProductsStatus(orgSlug);

  return {
    product: data?.products.find((p) => p.id === productId),
    isLoading,
    isError,
  };
}
