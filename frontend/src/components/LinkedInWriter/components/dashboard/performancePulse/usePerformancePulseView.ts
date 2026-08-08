/**
 * Derived Performance Pulse view — filter tabs + per-format ranking (Phase 4).
 */
import { useMemo } from "react";
import {
  countPerformancePulseByFilter,
  enrichPerformancePulseItems,
  rankPerformancePulseItems,
  sortByEngagementRate,
} from "./performancePulseRanking";
import type { LinkedInPost } from "../../../../../services/postAnalyticsApi";
import type {
  PerformancePulseFilter,
  PerformancePulseFilterCounts,
  PerformancePulseItem,
} from "./types";

export interface UsePerformancePulseViewResult {
  counts: PerformancePulseFilterCounts;
  topItems: PerformancePulseItem[];
  bottomItem: PerformancePulseItem | null;
  hasItemsForFilter: boolean;
}

export function usePerformancePulseView(
  posts: LinkedInPost[],
  filter: PerformancePulseFilter,
): UsePerformancePulseViewResult {
  return useMemo(() => {
    const sorted = sortByEngagementRate(posts);
    const allItems = enrichPerformancePulseItems(sorted);
    const counts = countPerformancePulseByFilter(allItems);
    const { top, bottom } = rankPerformancePulseItems(posts, filter);

    return {
      counts,
      topItems: top,
      bottomItem: bottom,
      hasItemsForFilter: filter === "all" ? allItems.length > 0 : counts[filter] > 0,
    };
  }, [posts, filter]);
}
