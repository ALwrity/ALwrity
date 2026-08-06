/**
 * Engagement Booster — API layer for optimize_engagement + preview scoring.
 */
import {
  linkedInGrowthApi,
  type PostPreviewScoreResponse,
} from "../../../../services/linkedInGrowthApi";
import { linkedInWriterApi } from "../../../../services/linkedInWriterApi";
import type { LinkedInDraftContentType } from "../../utils/linkedInDraftLibraryUtils";

const DEFAULT_OPTIMIZE_ERROR =
  "AI could not rewrite your draft. Please try again.";

export interface OptimizeEngagementOptions {
  industry?: string;
  tone?: string;
  target_audience?: string;
  contentType?: LinkedInDraftContentType;
}

export interface EngagementBoosterOptimizeResult {
  success: boolean;
  content?: string;
  error?: string;
}

export async function optimizeForEngagement(
  content: string,
  options: OptimizeEngagementOptions = {},
): Promise<EngagementBoosterOptimizeResult> {
  const { industry, tone, target_audience, contentType } = options;

  const res = await linkedInWriterApi.editContent({
    content,
    edit_type: "optimize_engagement",
    industry,
    tone,
    target_audience,
    parameters: contentType ? { content_type: contentType } : undefined,
  });

  const rewritten = res.content?.trim();
  if (!res.success || !rewritten) {
    return {
      success: false,
      error: res.error?.trim() || DEFAULT_OPTIMIZE_ERROR,
    };
  }

  return { success: true, content: rewritten };
}

export interface DraftScorePair {
  original: PostPreviewScoreResponse | null;
  optimised: PostPreviewScoreResponse | null;
  scoringAvailable: boolean;
}

/** Score before/after drafts; failures are non-fatal (scoring is optional). */
export async function scoreDraftPair(
  original: string,
  optimised: string,
): Promise<DraftScorePair> {
  const [origRes, optRes] = await Promise.allSettled([
    linkedInGrowthApi.getPostPreviewScore({ content: original }),
    linkedInGrowthApi.getPostPreviewScore({ content: optimised }),
  ]);

  const originalScore =
    origRes.status === "fulfilled" ? origRes.value : null;
  const optimisedScore =
    optRes.status === "fulfilled" ? optRes.value : null;

  return {
    original: originalScore,
    optimised: optimisedScore,
    scoringAvailable: Boolean(originalScore || optimisedScore),
  };
}
