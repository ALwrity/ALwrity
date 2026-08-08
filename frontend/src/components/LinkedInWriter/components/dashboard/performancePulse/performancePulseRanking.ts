/**
 * Rank LinkedIn analytics items by engagement rate for Performance Pulse.
 * Phase 4: optional per-format filter for fair within-type comparisons.
 */
import type { LinkedInPost } from "../../../../../services/postAnalyticsApi";
import { toPerformancePulseItem } from "./inferContentType";
import type {
  PerformanceContentType,
  PerformancePulseFilter,
  PerformancePulseFilterCounts,
  PerformancePulseItem,
} from "./types";

export function sortByEngagementRate(posts: LinkedInPost[]): LinkedInPost[] {
  return [...posts].sort(
    (a, b) =>
      (b.engagement?.engagement_rate ?? 0) -
      (a.engagement?.engagement_rate ?? 0),
  );
}

export function enrichPerformancePulseItems(
  posts: LinkedInPost[],
): PerformancePulseItem[] {
  return posts.map(toPerformancePulseItem);
}

export function filterPerformancePulseItems(
  items: PerformancePulseItem[],
  filter: PerformancePulseFilter,
): PerformancePulseItem[] {
  if (filter === "all") return items;
  return items.filter((item) => item.contentType === filter);
}

export function countPerformancePulseByFilter(
  items: PerformancePulseItem[],
): PerformancePulseFilterCounts {
  const counts: PerformancePulseFilterCounts = {
    all: items.length,
    post: 0,
    article: 0,
    carousel: 0,
    video_script: 0,
  };

  for (const item of items) {
    counts[item.contentType] += 1;
  }

  return counts;
}

export interface PerformancePulseRankedSnapshot {
  top: PerformancePulseItem[];
  bottom: PerformancePulseItem | null;
}

const MIN_ITEMS_FOR_BOTTOM = 2;

/** Top 3 performers + lowest performer (if not already in top 3). */
export function rankPerformancePulseItems(
  posts: LinkedInPost[],
  filter: PerformancePulseFilter = "all",
): PerformancePulseRankedSnapshot {
  const sorted = sortByEngagementRate(posts);
  const enriched = enrichPerformancePulseItems(sorted);
  const filtered = filterPerformancePulseItems(enriched, filter);

  const top = filtered.slice(0, 3);
  const bottomCandidate = filtered[filtered.length - 1] ?? null;
  const bottom =
    filtered.length >= MIN_ITEMS_FOR_BOTTOM &&
    bottomCandidate &&
    !top.some((item) => item.post.id === bottomCandidate.post.id)
      ? bottomCandidate
      : null;

  return { top, bottom };
}

/** Cross-format transform targets — excludes the source format. */
export function getTransformTargetFormats(
  sourceType: PerformanceContentType,
): PerformanceContentType[] {
  const all: PerformanceContentType[] = [
    "post",
    "article",
    "carousel",
    "video_script",
  ];
  return all.filter((type) => type !== sourceType);
}
