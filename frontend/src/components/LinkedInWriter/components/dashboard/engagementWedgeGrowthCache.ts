/**
 * Shared sessionStorage cache for Growth Engine / Engagement wedge modals.
 * Key: alwrity_growth_engine — also used by GrowthEnginePanel and DailyDigestWidget.
 */
import type {
  ConsolidatedGrowthResponse,
  NetworkSuggestionsResponse,
} from "../../../../services/linkedInGrowthApi";

export const GROWTH_CACHE_KEY = "alwrity_growth_engine";

export interface GrowthCachePayload {
  data: ConsolidatedGrowthResponse;
  cachedAt: number;
}

export function readGrowthCache(): GrowthCachePayload | null {
  try {
    const raw = sessionStorage.getItem(GROWTH_CACHE_KEY);
    return raw ? (JSON.parse(raw) as GrowthCachePayload) : null;
  } catch {
    return null;
  }
}

export function readGrowthCacheData(): ConsolidatedGrowthResponse | null {
  return readGrowthCache()?.data ?? null;
}

export function writeGrowthCache(data: ConsolidatedGrowthResponse): void {
  try {
    sessionStorage.setItem(
      GROWTH_CACHE_KEY,
      JSON.stringify({ data, cachedAt: Date.now() } satisfies GrowthCachePayload),
    );
  } catch {
    /* sessionStorage full or unavailable */
  }
}

/** Merge network suggestions into the consolidated cache (creates shell if missing). */
export function mergeNetworkSuggestionsIntoCache(
  networkSuggestions: NetworkSuggestionsResponse,
): ConsolidatedGrowthResponse {
  const existing = readGrowthCacheData();
  const merged: ConsolidatedGrowthResponse = existing
    ? { ...existing, network_suggestions: networkSuggestions }
    : {
        trending: null,
        network_suggestions: networkSuggestions,
        engagement_opportunities: null,
        viral_analysis: null,
        weekly_strategy: null,
        content_gaps: null,
        brand_scorecard: null,
        generated_at: networkSuggestions.generated_at,
      };
  writeGrowthCache(merged);
  return merged;
}

export function formatCacheAge(cachedAt: number): string {
  const ms = Date.now() - cachedAt;
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
