/**
 * Format-aware optimize_engagement for Performance Pulse boost action.
 */
import { optimizeForEngagement } from "../engagementBoosterApi";
import type { LinkedInPost } from "../../../../../services/postAnalyticsApi";
import type { PerformanceContentType } from "./types";

export interface BoostPerformanceContentResult {
  success: boolean;
  content?: string;
  error?: string;
}

export async function boostPerformanceContent(
  post: LinkedInPost,
  contentType: PerformanceContentType,
): Promise<BoostPerformanceContentResult> {
  const sourceText = post.text?.trim() ?? "";
  if (!sourceText) {
    return {
      success: false,
      error: "Nothing to boost — this item has no caption or text.",
    };
  }

  return optimizeForEngagement(sourceText, { contentType });
}
