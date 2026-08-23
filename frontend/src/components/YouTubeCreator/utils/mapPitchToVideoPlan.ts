/**
 * Map approved pitch + Phase 2 expansion onto the existing VideoPlan shape
 * so Build Scenes / render stay unchanged.
 */

import type { YouTubeVideoPitch } from "../../../hooks/useYouTubeCreatorState";
import type { VideoPlan } from "../../../services/youtubeApi";
import type { YouTubeExpansionPayload, YouTubePitchPayload } from "../../../services/youtubePitchApi";

export interface MapPitchToVideoPlanInput {
  pitch: Pick<YouTubeVideoPitch, "selected_title" | "video_summary" | "hook_concept">;
  expansion: YouTubeExpansionPayload;
  form: {
    duration_type: VideoPlan["duration_type"];
    target_audience?: string;
    video_goal?: string;
    brand_style?: string;
  };
}

function pitchId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pitch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function toYouTubeVideoPitch(
  pitch: YouTubePitchPayload,
  creativeAngle: string,
): YouTubeVideoPitch {
  return {
    id: pitchId(),
    creative_angle: (pitch.angle_used || creativeAngle || "").trim(),
    selected_title: (pitch.selected_title || "").trim(),
    video_summary: (pitch.video_summary || "").trim(),
    hook_concept: (pitch.hook_concept || "").trim(),
    main_content_beats: Array.isArray(pitch.main_content_beats)
      ? pitch.main_content_beats.map((beat) => String(beat).trim()).filter(Boolean)
      : [],
    generation: pitch.generation,
    research_enabled: pitch.research_enabled,
    research_sources: pitch.research_sources,
  };
}

export function mapPitchToVideoPlan({
  pitch,
  expansion,
  form,
}: MapPitchToVideoPlanInput): VideoPlan {
  try {
    const selectedTitle = (pitch.selected_title || expansion.approved_title || "").trim();
    const hookSpoken = (expansion.hook?.spoken_script || pitch.hook_concept || "").trim();
    const outline = (expansion.main_content_outline || []).map((beat) => ({
      section: (beat.section_title || "").trim(),
      description: (beat.spoken_script || "").trim(),
      duration_estimate: Number(beat.estimated_duration_seconds) || 0,
    }));

    const plan: VideoPlan = {
      video_summary: (pitch.video_summary || "").trim(),
      target_audience: (form.target_audience || "").trim(),
      video_goal: (form.video_goal || "").trim() || undefined,
      key_message: (expansion.key_message || "").trim() || undefined,
      content_outline: outline,
      hook_strategy: hookSpoken,
      call_to_action: (expansion.call_to_action || "").trim() || undefined,
      visual_style: (form.brand_style || "").trim(),
      tone: (form.brand_style || "").trim() || undefined,
      seo_keywords: Array.isArray(expansion.seo_keywords)
        ? expansion.seo_keywords.map((item) => String(item).trim()).filter(Boolean)
        : [],
      selected_title: selectedTitle || undefined,
      title_suggestions: selectedTitle ? [selectedTitle] : [],
      duration_type: expansion.duration_type || form.duration_type,
      duration_metadata: expansion.duration_metadata,
      research_enabled: expansion.research_enabled,
      research_sources: expansion.research_sources,
      research_sources_count: expansion.research_sources_count,
      generation: expansion.generation,
    };

    console.info("[mapPitchToVideoPlan] Mapped expansion to VideoPlan", {
      outlineCount: outline.length,
      hasSelectedTitle: Boolean(selectedTitle),
      hasHook: Boolean(hookSpoken),
      hasGeneration: Boolean(expansion.generation),
    });

    return plan;
  } catch (error) {
    console.error("[mapPitchToVideoPlan] Failed to map expansion", {
      outlineCount: expansion?.main_content_outline?.length ?? 0,
    });
    throw error instanceof Error ? error : new Error("Could not map pitch to video plan.");
  }
}
