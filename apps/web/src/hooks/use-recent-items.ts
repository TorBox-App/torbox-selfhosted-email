"use client";

import { useCallback, useEffect, useState } from "react";
import type { SearchResultItem } from "@/actions/search";

const MAX_RECENT_ITEMS = 10;

function getStorageKey(orgId: string): string {
  return `cmd_k_recent_${orgId}`;
}

export function useRecentItems(orgId: string | undefined) {
  const [items, setItems] = useState<SearchResultItem[]>([]);

  // Hydration-safe: load from localStorage in useEffect
  useEffect(() => {
    if (!orgId) {
      return;
    }
    try {
      const raw = localStorage.getItem(getStorageKey(orgId));
      if (raw) {
        setItems(JSON.parse(raw));
      }
    } catch {
      // Ignore parse errors
    }
  }, [orgId]);

  const addRecentItem = useCallback(
    (item: SearchResultItem) => {
      if (!orgId) {
        return;
      }
      setItems((prev) => {
        const deduped = prev.filter((i) => i.id !== item.id);
        const next = [item, ...deduped].slice(0, MAX_RECENT_ITEMS);
        try {
          localStorage.setItem(getStorageKey(orgId), JSON.stringify(next));
        } catch {
          // Ignore storage errors
        }
        return next;
      });
    },
    [orgId]
  );

  return { recentItems: items, addRecentItem };
}
