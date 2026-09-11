/**
 * Per-fetch Channel Pulse / Video Performance status copy.
 * Reuses typical-step percent from pitch generation. No live backend %.
 */

import { planGenerationProgressPercent } from "../utils/youtubePlanGenerationLoader";

export type YouTubeAnalysisWedgeFetchId = "pulse" | "performance";

export const YOUTUBE_ANALYSIS_WEDGE_LOADER_INTERVAL_MS = 1200;

const TYPICAL_STEPS_DISCLAIMER =
  "The bar follows typical steps, not a live server percentage.";

export type YouTubeAnalysisWedgeLoaderCopy = {
  title: string;
  messages: readonly string[];
  steps: string[];
  hint: string;
  intervalMs: number;
};

const EMPTY_COPY: YouTubeAnalysisWedgeLoaderCopy = {
  title: "",
  messages: [],
  steps: [],
  hint: TYPICAL_STEPS_DISCLAIMER,
  intervalMs: YOUTUBE_ANALYSIS_WEDGE_LOADER_INTERVAL_MS,
};

const COPY: Record<YouTubeAnalysisWedgeFetchId, YouTubeAnalysisWedgeLoaderCopy> = {
  pulse: {
    title: "Loading channel pulse",
    messages: [
      "Checking your channel...",
      "Asking YouTube Data and Analytics...",
      "Building subscribers, views, and watch time...",
    ],
    steps: ["Check channel", "Load pulse", "Show stats"],
    hint: TYPICAL_STEPS_DISCLAIMER,
    intervalMs: YOUTUBE_ANALYSIS_WEDGE_LOADER_INTERVAL_MS,
  },
  performance: {
    title: "Loading video performance",
    messages: [
      "Asking YouTube for recent uploads...",
      "Reading public views, likes, and comments...",
      "Building your upload list...",
    ],
    steps: ["Load uploads", "Read public stats", "Show list"],
    hint: TYPICAL_STEPS_DISCLAIMER,
    intervalMs: YOUTUBE_ANALYSIS_WEDGE_LOADER_INTERVAL_MS,
  },
};

export function getYouTubeAnalysisWedgeLoaderCopy(
  fetch: YouTubeAnalysisWedgeFetchId | string,
): YouTubeAnalysisWedgeLoaderCopy {
  if (fetch === "pulse" || fetch === "performance") {
    return COPY[fetch];
  }
  console.error("[YouTubeAnalysisWedge] Progress copy unknown", { fetch });
  return EMPTY_COPY;
}

export function youtubeAnalysisWedgeProgressPercent(
  loaderMessageIndex: number,
  messageCount: number,
): number {
  return planGenerationProgressPercent(loaderMessageIndex, messageCount);
}
