"use client";

import { useQuery } from "@tanstack/react-query";
import { getPropertyKeys } from "@/actions/segments";

export const propertyKeyKeys = {
  all: ["propertyKeys"] as const,
  list: (organizationId: string) =>
    [...propertyKeyKeys.all, organizationId] as const,
};

export function usePropertyKeys(organizationId: string) {
  return useQuery({
    queryKey: propertyKeyKeys.list(organizationId),
    queryFn: async () => {
      const result = await getPropertyKeys(organizationId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.keys;
    },
    staleTime: 5 * 60 * 1000,
  });
}
