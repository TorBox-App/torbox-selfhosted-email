"use client";

import { useQuery } from "@tanstack/react-query";
import type { EmailListItem } from "../types";

export function useEmailsData(
  orgSlug: string,
  days = 7,
  limit = 100,
  status?: string,
  search?: string
) {
  return useQuery<EmailListItem[]>({
    queryKey: ["emails", orgSlug, days, limit, status, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        days: String(days),
        limit: String(limit),
      });
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      const response = await fetch(`/api/${orgSlug}/emails?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch emails");
      }
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
  });
}
