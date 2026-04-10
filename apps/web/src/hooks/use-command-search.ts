"use client";

import { useDebouncedValue } from "@tanstack/react-pacer";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  type SearchEntityType,
  type SearchResultItem,
  universalSearch,
} from "@/actions/search";

export const searchKeys = {
  all: ["command-search"] as const,
  results: (orgId: string, query: string) =>
    [...searchKeys.all, orgId, query] as const,
};

const EMPTY_RESULTS: Record<SearchEntityType, SearchResultItem[]> = {
  contact: [],
  template: [],
  broadcast: [],
  workflow: [],
  segment: [],
  topic: [],
  brandKit: [],
};

export function useCommandSearch(orgId: string | undefined) {
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery] = useDebouncedValue(inputValue, { wait: 300 });

  const isServerMode = debouncedQuery.length >= 2;

  const { data, isFetching } = useQuery({
    queryKey: searchKeys.results(orgId ?? "", debouncedQuery),
    queryFn: async () => {
      if (!orgId) {
        return EMPTY_RESULTS;
      }
      const result = await universalSearch(orgId, debouncedQuery);
      if (!result.success) {
        return EMPTY_RESULTS;
      }
      return result.results;
    },
    enabled: !!orgId && isServerMode,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  return {
    inputValue,
    setInputValue,
    results: data ?? EMPTY_RESULTS,
    isSearching: isFetching,
    isServerMode,
  };
}
