"use client";

import { useQuery } from "@tanstack/react-query";
import type { EmailListItem } from "../types";

export function useEmailsData(orgSlug: string, days = 7, limit = 100) {
  return useQuery<EmailListItem[]>({
    queryKey: ["emails", orgSlug, days, limit],
    queryFn: async () => {
      const response = await fetch(
        `/api/${orgSlug}/emails?days=${days}&limit=${limit}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch emails");
      }
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
  });
}
