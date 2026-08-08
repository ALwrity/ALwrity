/**
 * Filter tab definitions for Performance Pulse (Phase 4).
 */
import { getPerformanceContentTypeMeta } from "./contentTypeLabels";
import type { PerformancePulseFilter } from "./types";

export interface PerformancePulseFilterTab {
  id: PerformancePulseFilter;
  label: string;
  icon?: string;
}

export const PERFORMANCE_PULSE_FILTER_TABS: PerformancePulseFilterTab[] = [
  { id: "all", label: "All" },
  {
    id: "post",
    label: getPerformanceContentTypeMeta("post").label + "s",
    icon: getPerformanceContentTypeMeta("post").icon,
  },
  {
    id: "article",
    label: getPerformanceContentTypeMeta("article").label + "s",
    icon: getPerformanceContentTypeMeta("article").icon,
  },
  {
    id: "carousel",
    label: getPerformanceContentTypeMeta("carousel").label + "s",
    icon: getPerformanceContentTypeMeta("carousel").icon,
  },
  {
    id: "video_script",
    label: "Videos",
    icon: getPerformanceContentTypeMeta("video_script").icon,
  },
];

export function getFilterTabLabel(
  filter: PerformancePulseFilter,
  count?: number,
): string {
  const tab = PERFORMANCE_PULSE_FILTER_TABS.find((t) => t.id === filter);
  const base = tab?.label ?? "All";
  if (count === undefined || filter === "all") return base;
  return `${base} (${count})`;
}

export function getEmptyFilterMessage(filter: PerformancePulseFilter): string {
  switch (filter) {
    case "post":
      return "No text posts in your recent analytics.";
    case "article":
      return "No articles detected in your recent analytics.";
    case "carousel":
      return "No carousel or document posts in your recent analytics.";
    case "video_script":
      return "No video posts in your recent analytics.";
    default:
      return "No content loaded.";
  }
}

export function getTopSectionLabel(filter: PerformancePulseFilter): string {
  if (filter === "all") return "Top Performing Content";
  const tab = PERFORMANCE_PULSE_FILTER_TABS.find((t) => t.id === filter);
  return `Top ${tab?.label ?? "Content"}`;
}
