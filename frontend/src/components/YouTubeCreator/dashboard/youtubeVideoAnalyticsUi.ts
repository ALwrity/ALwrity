/**
 * Video Analytics Hub chrome — Studio tabs and date presets.
 * Range math lives in youtubeVideoAnalyticsDateRange.ts.
 */

export type YouTubeVideoAnalyticsTabId =
  | "overview"
  | "audience"
  | "content"
  | "trends";

export type YouTubeVideoAnalyticsPresetId =
  | "last_7"
  | "last_28"
  | "last_90"
  | "last_365"
  | "lifetime";

export const YOUTUBE_VIDEO_ANALYTICS_TABS: ReadonlyArray<{
  id: YouTubeVideoAnalyticsTabId;
  label: string;
}> = [
  { id: "overview", label: "Overview" },
  { id: "audience", label: "Audience" },
  { id: "content", label: "Content" },
  { id: "trends", label: "Trends" },
];

export const YOUTUBE_VIDEO_ANALYTICS_PRESETS: ReadonlyArray<{
  id: YouTubeVideoAnalyticsPresetId;
  label: string;
  days: number | null;
}> = [
  { id: "last_7", label: "Last 7 days", days: 7 },
  { id: "last_28", label: "Last 28 days", days: 28 },
  { id: "last_90", label: "Last 90 days", days: 90 },
  { id: "last_365", label: "Last 365 days", days: 365 },
  { id: "lifetime", label: "Lifetime", days: null },
];

export const YOUTUBE_VIDEO_ANALYTICS_DEFAULT_TAB: YouTubeVideoAnalyticsTabId =
  "overview";

export function emptyAnalyticsPanelCopy(tab: YouTubeVideoAnalyticsTabId): string {
  const item = YOUTUBE_VIDEO_ANALYTICS_TABS.find((entry) => entry.id === tab);
  if (!item) {
    console.warn("[YouTubeVideoAnalytics] Unknown tab");
    return "Metrics will show here when analytics is connected.";
  }
  if (tab === "content" || tab === "trends") {
    return `${item.label} analytics is coming soon.`;
  }
  return `${item.label} metrics will show here when analytics is connected.`;
}

export function nextAnalyticsTab(
  current: YouTubeVideoAnalyticsTabId,
  delta: 1 | -1,
): YouTubeVideoAnalyticsTabId {
  const ids = YOUTUBE_VIDEO_ANALYTICS_TABS.map((item) => item.id);
  const index = ids.indexOf(current);
  if (index < 0) {
    console.warn("[YouTubeVideoAnalytics] Unknown tab");
    return YOUTUBE_VIDEO_ANALYTICS_DEFAULT_TAB;
  }
  const next = (index + delta + ids.length) % ids.length;
  return ids[next];
}

export const YOUTUBE_VIDEO_ANALYTICS_WINDOW_UNSUPPORTED =
  "Channel overview needs a valid date range to load analytics.";
