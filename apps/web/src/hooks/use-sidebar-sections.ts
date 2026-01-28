"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sidebar_sections";

type SectionStates = Record<string, boolean>;

/**
 * Hook to persist sidebar section expansion states in localStorage.
 * Merges user preferences with URL-based auto-opening.
 */
export function useSidebarSections(sectionTitles: string[]) {
  const [sectionStates, setSectionStates] = useState<SectionStates>(() => {
    // Initialize all sections as closed, will be updated from storage on mount
    return Object.fromEntries(sectionTitles.map((title) => [title, false]));
  });
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SectionStates;
        setSectionStates((prev) => ({ ...prev, ...parsed }));
      } catch {
        // Invalid JSON, ignore
      }
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage when states change (after hydration)
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sectionStates));
    }
  }, [sectionStates, isHydrated]);

  const toggleSection = useCallback((title: string) => {
    setSectionStates((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  }, []);

  const openSection = useCallback((title: string) => {
    setSectionStates((prev) => {
      if (prev[title]) {
        return prev; // Already open
      }
      return { ...prev, [title]: true };
    });
  }, []);

  const isSectionOpen = useCallback(
    (title: string) => sectionStates[title] ?? false,
    [sectionStates]
  );

  return {
    isSectionOpen,
    toggleSection,
    openSection,
    isHydrated,
  };
}
