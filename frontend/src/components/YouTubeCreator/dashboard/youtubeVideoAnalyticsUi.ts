/**
 * Video Analytics Hub chrome — Studio tabs and date presets.
 * No metric values. No API client.
 */

export type YouTubeVideoAnalyticsTabId =
  | "overview"
  | "reach"
  | "engagement"
  | "audience";

export type YouTubeVideoAnalyticsPresetId =
  | "last_7"
  | "last_28"
  | "last_90"
  | "all_time";

export const YOUTUBE_VIDEO_ANALYTICS_TABS: ReadonlyArray<{
  id: YouTubeVideoAnalyticsTabId;
  label: string;
}> = [
  { id: "overview", label: "Overview" },
  { id: "reach", label: "Reach" },
  { id: "engagement", label: "Engagement" },
  { id: "audience", label: "Audience" },
];

export const YOUTUBE_VIDEO_ANALYTICS_PRESETS: ReadonlyArray<{
  id: YouTubeVideoAnalyticsPresetId;
  label: string;
  days: number | null;
}> = [
  { id: "last_7", label: "Last 7 days", days: 7 },
  { id: "last_28", label: "Last 28 days", days: 28 },
  { id: "last_90", label: "Last 90 days", days: 90 },
  { id: "all_time", label: "All time", days: null },
];

export const YOUTUBE_VIDEO_ANALYTICS_DEFAULT_PRESET: YouTubeVideoAnalyticsPresetId =
  "last_28";

export const YOUTUBE_VIDEO_ANALYTICS_DEFAULT_TAB: YouTubeVideoAnalyticsTabId =
  "overview";

const RANGE_UNAVAILABLE = "—";

function isValidCalendarDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function calendarDay(source: Date): Date {
  return new Date(source.getFullYear(), source.getMonth(), source.getDate());
}

function shiftDays(source: Date, days: number): Date {
  const day = calendarDay(source);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + days);
}

export function dateRangeForPreset(
  preset: YouTubeVideoAnalyticsPresetId,
  today: Date,
): { start: Date | null; end: Date | null } {
  const match = YOUTUBE_VIDEO_ANALYTICS_PRESETS.find((row) => row.id === preset);
  if (!match || match.days == null) {
    return { start: null, end: null };
  }
  if (!isValidCalendarDate(today)) {
    console.warn("[YouTubeVideoAnalytics] Invalid date for range");
    return { start: null, end: null };
  }
  const end = calendarDay(today);
  return { start: shiftDays(end, -match.days), end };
}

function formatMonthDay(value: Date): string {
  return value.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatAnalyticsDateRange(
  preset: YouTubeVideoAnalyticsPresetId,
  today: Date,
): string {
  if (preset === "all_time") {
    return "All time";
  }
  const { start, end } = dateRangeForPreset(preset, today);
  if (!start || !end) {
    return RANGE_UNAVAILABLE;
  }
  return `${formatMonthDay(start)} – ${formatMonthDay(end)}, ${end.getFullYear()}`;
}

export function formatAnalyticsPresetLabel(
  preset: YouTubeVideoAnalyticsPresetId,
): string {
  return YOUTUBE_VIDEO_ANALYTICS_PRESETS.find((row) => row.id === preset)?.label || preset;
}

export function emptyAnalyticsPanelCopy(tab: YouTubeVideoAnalyticsTabId): string {
  const label = YOUTUBE_VIDEO_ANALYTICS_TABS.find((item) => item.id === tab)?.label;
  if (!label) {
    console.warn("[YouTubeVideoAnalytics] Unknown tab");
    return "Metrics will show here when analytics is connected.";
  }
  return `${label} metrics will show here when analytics is connected.`;
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

export function overviewDaysForPreset(
  preset: YouTubeVideoAnalyticsPresetId,
): number | null {
  return YOUTUBE_VIDEO_ANALYTICS_PRESETS.find((row) => row.id === preset)?.days ?? null;
}

export const YOUTUBE_VIDEO_ANALYTICS_WINDOW_UNSUPPORTED =
  "Channel overview supports Last 7, 28, or 90 days. Pick a window to load analytics.";
