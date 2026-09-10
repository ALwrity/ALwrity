/**
 * Per-fetch Video Analytics status copy.
 * Reuses typical-step percent from pitch generation. No live backend %.
 */

import { planGenerationProgressPercent } from "../utils/youtubePlanGenerationLoader";

export type YouTubeVideoAnalyticsFetchId = "overview" | "audience";

export const YOUTUBE_VIDEO_ANALYTICS_LOADER_INTERVAL_MS = 1200;

const TYPICAL_STEPS_DISCLAIMER =
  "The bar follows typical steps, not a live server percentage.";

export type YouTubeVideoAnalyticsLoaderCopy = {
  title: string;
  messages: readonly string[];
  steps: string[];
  hint: string;
  intervalMs: number;
};

const EMPTY_COPY: YouTubeVideoAnalyticsLoaderCopy = {
  title: "",
  messages: [],
  steps: [],
  hint: TYPICAL_STEPS_DISCLAIMER,
  intervalMs: YOUTUBE_VIDEO_ANALYTICS_LOADER_INTERVAL_MS,
};

const COPY: Record<YouTubeVideoAnalyticsFetchId, YouTubeVideoAnalyticsLoaderCopy> = {
  overview: {
    title: "Loading channel overview",
    messages: [
      "Checking the date range...",
      "Asking YouTube Analytics...",
      "Building views and watch time...",
    ],
    steps: ["Check date range", "Load Analytics", "Show overview"],
    hint: TYPICAL_STEPS_DISCLAIMER,
    intervalMs: YOUTUBE_VIDEO_ANALYTICS_LOADER_INTERVAL_MS,
  },
  audience: {
    title: "Loading channel audience",
    messages: [
      "Checking the date range...",
      "Asking YouTube Analytics...",
      "Building age, country, subscriber, and device...",
    ],
    steps: ["Check date range", "Load Analytics", "Show audience"],
    hint: TYPICAL_STEPS_DISCLAIMER,
    intervalMs: YOUTUBE_VIDEO_ANALYTICS_LOADER_INTERVAL_MS,
  },
};

export function getYouTubeVideoAnalyticsLoaderCopy(
  fetch: YouTubeVideoAnalyticsFetchId | string,
): YouTubeVideoAnalyticsLoaderCopy {
  if (fetch === "overview" || fetch === "audience") {
    return COPY[fetch];
  }
  console.error("[YouTubeVideoAnalytics] Progress copy unknown", { fetch });
  return EMPTY_COPY;
}

export function youtubeVideoAnalyticsProgressPercent(
  loaderMessageIndex: number,
  messageCount: number,
): number {
  return planGenerationProgressPercent(loaderMessageIndex, messageCount);
}
