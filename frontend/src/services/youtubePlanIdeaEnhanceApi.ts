/**
 * Plan Your Video — enhance topic API client.
 */

import { longRunningApiClient } from "../api/client";

const API_BASE = "/api/youtube";

export interface YouTubePlanIdeaEnhanceRequest {
  user_idea: string;
  duration_type?: "shorts" | "medium" | "long";
  language?: string;
}

export interface YouTubePlanIdeaEnhanceResult {
  enhanced_ideas: string[];
  rationales: string[];
  message?: string;
}

export function parseYouTubePlanIdeaEnhanceResponse(
  payload: unknown,
): YouTubePlanIdeaEnhanceResult {
  const data = payload as {
    success?: boolean;
    enhanced_ideas?: unknown;
    rationales?: unknown;
    message?: string;
  };
  const ideas = Array.isArray(data?.enhanced_ideas)
    ? data.enhanced_ideas.filter((item): item is string => typeof item === "string" && item.trim() !== "")
    : [];
  if (ideas.length !== 3) {
    throw new Error("Expected exactly 3 enhanced ideas.");
  }
  const rationales = Array.isArray(data?.rationales)
    ? data.rationales.map((item) => (typeof item === "string" ? item : ""))
    : ["", "", ""];
  while (rationales.length < 3) {
    rationales.push("");
  }
  return {
    enhanced_ideas: ideas,
    rationales: rationales.slice(0, 3),
    message: data?.message,
  };
}

function youtubePlanEnhanceFailureMessage(error: unknown): string {
  const fallback = "Could not enhance this topic. Please try again.";
  const err = error as {
    message?: string;
    response?: { data?: { detail?: unknown; message?: unknown } };
  };
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }
  const apiMessage = err?.response?.data?.message;
  if (typeof apiMessage === "string" && apiMessage.trim()) {
    return apiMessage.trim();
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

export async function enhancePlanIdea(
  request: YouTubePlanIdeaEnhanceRequest,
): Promise<YouTubePlanIdeaEnhanceResult> {
  try {
    console.info("[YouTubePlan] Enhance topic request", {
      ideaLen: request.user_idea.trim().length,
      duration_type: request.duration_type,
      language: request.language,
    });
    const response = await longRunningApiClient.post(`${API_BASE}/plan/idea/enhance`, request);
    const parsed = parseYouTubePlanIdeaEnhanceResponse(response.data);
    console.info("[YouTubePlan] Enhance topic succeeded", { ideaCount: parsed.enhanced_ideas.length });
    return parsed;
  } catch (error: unknown) {
    const detail = youtubePlanEnhanceFailureMessage(error);
    console.error("[YouTubePlan] Enhance topic failed", { detailLen: detail.length });
    throw new Error(detail);
  }
}
