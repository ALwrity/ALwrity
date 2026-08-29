import type { Scene } from "../../../services/youtubeApi";
import { resolveYoutubeSceneVideoDuration } from "../utils/buildYoutubeSceneVideoPromptPreview";

/** Matches backend planner_config.SPOKEN_WORDS_PER_MINUTE. */
export const YOUTUBE_SPOKEN_WORDS_PER_MINUTE = 150;

/**
 * Text WaveSpeed TTS must speak: the scene script paragraph only.
 * Never add title prefixes or [bracket] stage directions.
 */
export function buildYoutubeSceneSpeechText(scene: Scene): string {
  try {
    return (scene?.narration || "").trim();
  } catch (error) {
    console.error("[YouTubeSceneAudio] Failed to read scene narration", {
      sceneNumber: scene?.scene_number,
      error: error instanceof Error ? error.message : "unknown",
    });
    return "";
  }
}

/** Estimate spoken seconds at 150 WPM (same clock as expand / parse). */
export function estimateYoutubeSpeechSeconds(speechText: string): number {
  try {
    const words = (speechText || "").trim().split(/\s+/).filter(Boolean).length;
    if (words <= 0) {
      return 0;
    }
    return Math.max(1, Math.round((words * 60) / YOUTUBE_SPOKEN_WORDS_PER_MINUTE));
  } catch (error) {
    console.error("[YouTubeSceneAudio] Failed to estimate speech seconds", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return 0;
  }
}

/**
 * Log when estimated speech length exceeds the WAN clip for this scene.
 * Does not rewrite narration (word caps are Phase 4).
 */
export function warnIfYoutubeSpeechExceedsClip(
  speechText: string,
  durationEstimate?: number | null,
): { clipSeconds: number; speechSeconds: number } {
  try {
    const clipSeconds = resolveYoutubeSceneVideoDuration(durationEstimate);
    const speechSeconds = estimateYoutubeSpeechSeconds(speechText);
    const wordCount = (speechText || "").trim().split(/\s+/).filter(Boolean).length;
    if (speechSeconds > clipSeconds) {
      console.warn("[YouTubeSceneAudio] Speech longer than WAN clip; WaveSpeed will keep the first clip seconds only", {
        clipSeconds,
        speechSeconds,
        wordCount,
      });
    } else {
      console.info("[YouTubeSceneAudio] Speech clock ok", {
        clipSeconds,
        speechSeconds,
        wordCount,
      });
    }
    return { clipSeconds, speechSeconds };
  } catch (error) {
    console.error("[YouTubeSceneAudio] Speech clock failed; defaulting to 5s clip", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return { clipSeconds: 5, speechSeconds: 0 };
  }
}

/** UI-only delivery notes. Must not be sent to WaveSpeed. */
export function buildEnrichedSceneText(scene: Scene): string {
  let enrichedText = scene.narration;

  if (scene.title && scene.title !== scene.narration.substring(0, scene.title.length)) {
    enrichedText = `${scene.title}. ${enrichedText}`;
  }

  if (scene.emphasis_tags && scene.emphasis_tags.length > 0) {
    const deliveryHints = scene.emphasis_tags.map((tag) => {
      switch (tag) {
        case "hook":
          return "speak with energy and excitement";
        case "cta":
          return "speak persuasively and confidently";
        case "transition":
          return "speak smoothly and clearly";
        default:
          return "speak professionally and clearly";
      }
    });
    enrichedText += ` [${deliveryHints[0]}]`;
  }

  if (scene.visual_cues && scene.visual_cues.length > 0) {
    const audioRelevantCues = scene.visual_cues.filter(
      (cue) =>
        cue.toLowerCase().includes("slow") ||
        cue.toLowerCase().includes("fast") ||
        cue.toLowerCase().includes("energetic") ||
        cue.toLowerCase().includes("calm") ||
        cue.toLowerCase().includes("dramatic") ||
        cue.toLowerCase().includes("intense"),
    );
    if (audioRelevantCues.length > 0) {
      enrichedText += ` [Pacing: ${audioRelevantCues.join(", ")}]`;
    }
  }

  if (scene.duration_estimate && scene.duration_estimate > 0) {
    const wordsPerMinute = enrichedText.split(" ").length / (scene.duration_estimate / 60);
    if (wordsPerMinute > 200) {
      enrichedText += ` [Speak at a natural, conversational pace]`;
    } else if (wordsPerMinute < 120) {
      enrichedText += ` [Take time to articulate clearly]`;
    }
  }

  if (enrichedText.length > 9500) {
    enrichedText = `${enrichedText.substring(0, 9500)}...`;
  }

  return enrichedText;
}
