/**
 * YouTube pitch / expand API client (Issue #434 Phase 3).
 * Lives here because youtubeApi.ts already exceeds 500 lines.
 */

import { apiClient, longRunningApiClient } from "../api/client";
import type { VideoPlanGeneration, VideoPlanRequest, VideoPlanResearchSource } from "./youtubeApi";

const API_BASE = "/api/youtube";

/** Expand can run two LLM attempts plus validation; keep this longer than the 5-minute default. */
export const YOUTUBE_EXPAND_REQUEST_TIMEOUT_MS = 600000;

export interface YouTubePitchRequest extends VideoPlanRequest {
  creative_angle: string;
}

export interface YouTubePitchPayload {
  selected_title: string;
  video_summary: string;
  hook_concept: string;
  main_content_beats: string[];
  angle_used: string;
  duration_type?: string;
  generation?: VideoPlanGeneration;
  research_enabled?: boolean;
  research_sources?: VideoPlanResearchSource[];
  research_sources_count?: number;
  /** Compact facts block reused on expand so Exa is not called twice. */
  research_prompt_block?: string;
}

export interface YouTubePitchResponse {
  success: boolean;
  pitch?: YouTubePitchPayload;
  message: string;
}

export interface YouTubeApprovedPitch {
  selected_title: string;
  video_summary?: string;
  hook_concept?: string;
  main_content_beats?: string[];
  angle_used?: string;
  creative_angle?: string;
  research_prompt_block?: string;
  research_sources?: VideoPlanResearchSource[];
}

export interface YouTubeExpandRequest extends VideoPlanRequest {
  approved_pitch: YouTubeApprovedPitch;
}

export interface YouTubeExpansionBeat {
  scene_number: number;
  section_title: string;
  context?: string;
  application?: string;
  frame?: string;
  mini_hook_out?: string;
  spoken_script: string;
  visual?: string;
  estimated_duration_seconds: number;
}

export interface YouTubeExpansionHook {
  context?: string;
  common_belief?: string;
  contrarian_turn?: string;
  proof?: string;
  plan_statement?: string;
  spoken_script: string;
}

export interface YouTubeExpansionPayload {
  hook: YouTubeExpansionHook;
  main_content_outline: YouTubeExpansionBeat[];
  outro: string;
  call_to_action: string;
  key_message: string;
  seo_keywords: string[];
  full_script?: string;
  approved_title?: string;
  duration_type?: string;
  duration_metadata?: {
    target_seconds?: number;
    max_scenes?: number;
    scene_duration_range?: [number, number];
    hook_seconds?: number;
  };
  generation?: VideoPlanGeneration;
  research_enabled?: boolean;
  research_sources?: VideoPlanResearchSource[];
  research_sources_count?: number;
}

export interface YouTubeExpandResponse {
  success: boolean;
  expansion?: YouTubeExpansionPayload;
  full_script?: string;
  message: string;
}

function pitchErrorMessage(error: unknown, fallback: string): string {
  const err = error as {
    name?: string;
    message?: string;
    response?: { data?: { message?: string; detail?: string } };
  };
  if (err?.name === "RequestTimeoutError" || err?.message?.includes("timeout")) {
    return fallback;
  }
  return err?.response?.data?.message || err?.response?.data?.detail || err?.message || fallback;
}

export interface YouTubePitchPreviewResponse {
  success: boolean;
  system_prompt?: string;
  user_prompt?: string;
  message: string;
}

export async function previewPitchPrompt(
  request: YouTubePitchRequest,
): Promise<YouTubePitchPreviewResponse> {
  const language = (request.language || "en").trim() || "en";
  try {
    console.info("[youtubeApi] previewPitchPrompt started", {
      durationType: request.duration_type,
      angleLen: request.creative_angle?.trim().length ?? 0,
      ideaLen: request.user_idea?.trim().length ?? 0,
      language,
      enableResearch: Boolean(request.enable_research),
    });
    const response = await apiClient.post(`${API_BASE}/plan/pitch/preview`, request);
    const data = response?.data as YouTubePitchPreviewResponse | undefined;
    if (!data || typeof data !== "object") {
      console.error("[youtubeApi] previewPitchPrompt empty response", { language });
      throw new Error("Failed to load the pitch prompt preview. Please try again.");
    }
    console.info("[youtubeApi] previewPitchPrompt succeeded", {
      language,
      success: Boolean(data.success),
      systemLen: (data.system_prompt || "").length,
      userLen: (data.user_prompt || "").length,
    });
    return data;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("Failed to load the pitch prompt preview")) {
      throw error;
    }
    const err = error as { response?: { status?: number }; message?: string };
    console.error("[youtubeApi] previewPitchPrompt failed", {
      language,
      status: err?.response?.status,
      timedOut: Boolean(err?.message?.toLowerCase().includes("timeout")),
    });
    throw new Error(
      pitchErrorMessage(error, "Failed to load the pitch prompt preview. Please try again."),
    );
  }
}

export async function generatePitch(request: YouTubePitchRequest): Promise<YouTubePitchResponse> {
  try {
    console.info("[youtubeApi] generatePitch started", {
      durationType: request.duration_type,
      angleLen: request.creative_angle?.trim().length ?? 0,
      ideaLen: request.user_idea?.trim().length ?? 0,
    });
    const response = await longRunningApiClient.post(`${API_BASE}/plan/pitch`, request);
    console.info("[youtubeApi] generatePitch succeeded");
    return response.data;
  } catch (error: unknown) {
    const err = error as { response?: { status?: number }; message?: string };
    console.error("[youtubeApi] generatePitch failed", {
      status: err?.response?.status,
      timedOut: Boolean(err?.message?.toLowerCase().includes("timeout")),
    });
    throw new Error(
      pitchErrorMessage(
        error,
        "Pitch generation is taking longer than expected. Please check your internet connection and try again.",
      ),
    );
  }
}

export async function expandPitchToScript(
  request: YouTubeExpandRequest,
): Promise<YouTubeExpandResponse> {
  const language = (request.language || "en").trim() || "en";
  try {
    console.info("[youtubeApi] expandPitchToScript started", {
      durationType: request.duration_type,
      titleLen: request.approved_pitch?.selected_title?.trim().length ?? 0,
      language,
      timeoutMs: YOUTUBE_EXPAND_REQUEST_TIMEOUT_MS,
    });
    const response = await longRunningApiClient.post(
      `${API_BASE}/plan/expand`,
      request,
      { timeout: YOUTUBE_EXPAND_REQUEST_TIMEOUT_MS },
    );
    const data = response?.data as YouTubeExpandResponse | undefined;
    if (!data || typeof data !== "object") {
      console.error("[youtubeApi] expandPitchToScript empty response", { language });
      throw new Error("Failed to expand pitch. Please try again.");
    }
    console.info("[youtubeApi] expandPitchToScript succeeded", {
      language,
      success: Boolean(data.success),
      scriptLen: (data.full_script || "").length,
    });
    return data;
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Failed to expand pitch. Please try again.") {
      throw error;
    }
    const err = error as { response?: { status?: number }; message?: string };
    console.error("[youtubeApi] expandPitchToScript failed", {
      language,
      status: err?.response?.status,
      timedOut: Boolean(err?.message?.toLowerCase().includes("timeout")),
      timeoutMs: YOUTUBE_EXPAND_REQUEST_TIMEOUT_MS,
    });
    throw new Error(
      pitchErrorMessage(
        error,
        "Script expansion is taking longer than expected. Please wait and try again.",
      ),
    );
  }
}
