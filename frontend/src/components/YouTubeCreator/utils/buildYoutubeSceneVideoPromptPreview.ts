/**
 * Client-side YouTube scene video prompt preview (mirrors youtube_scene_video_prompts.py).
 */

export const YOUTUBE_WAN25_ENABLE_PROMPT_EXPANSION = true;

export interface YoutubeSceneVideoPromptPreviewInput {
  visual_prompt?: string;
  enhanced_visual_prompt?: string;
  duration_estimate?: number;
  imageUrl?: string;
  audioUrl?: string;
}

export interface YoutubeSceneVideoRequestPreview {
  visualPrompt: string;
  promptSource: "enhanced_visual_prompt" | "visual_prompt";
  generationMode: "i2v" | "t2v";
  duration: number;
  durationEstimate: number | null;
  enablePromptExpansion: boolean;
  hasSystemPrompt: boolean;
  imageAttached: boolean;
  audioAttached: boolean;
  imageUrl: string;
  audioUrl: string;
  audioNote: string;
}

function safeMediaRef(url?: string): string {
  if (!url) {
    return "";
  }
  return url.split("?")[0].trim();
}

export function buildYoutubeSceneVideoPromptPreview(
  input: YoutubeSceneVideoPromptPreviewInput,
): YoutubeSceneVideoRequestPreview {
  const enhanced = (input.enhanced_visual_prompt || "").trim();
  const visual = (input.visual_prompt || "").trim();
  const visualPrompt = enhanced || visual;
  const promptSource = enhanced ? "enhanced_visual_prompt" : "visual_prompt";
  const estimate = Number(input.duration_estimate);
  const durationEstimate = Number.isFinite(estimate) ? estimate : null;
  const duration = durationEstimate == null || durationEstimate <= 7 ? 5 : 10;
  const imageUrl = safeMediaRef(input.imageUrl);
  const audioUrl = safeMediaRef(input.audioUrl);

  return {
    visualPrompt,
    promptSource,
    generationMode: imageUrl ? "i2v" : "t2v",
    duration,
    durationEstimate,
    enablePromptExpansion: YOUTUBE_WAN25_ENABLE_PROMPT_EXPANSION,
    hasSystemPrompt: false,
    imageAttached: Boolean(imageUrl),
    audioAttached: Boolean(audioUrl),
    imageUrl,
    audioUrl,
    audioNote:
      `WAN 2.5 clip length is ${duration}s. If attached audio is longer, ` +
      "the API keeps only the first 5s or 10s.",
  };
}
