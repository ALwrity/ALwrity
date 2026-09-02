/**
 * Decide which video this Video Creator draft may publish.
 * Account-rescued combined files and leftover renderStatus URLs are never the target.
 */
import { youtubePublishSourceMeta } from "../../../hooks/youtubePublishLog";

export type YouTubeDraftPublishSource = "combined" | "scene_clip" | "none";

export interface YouTubeDraftPublishScene {
  scene_number: number;
  enabled?: boolean;
  videoUrl?: string | null;
}

export interface YouTubeDraftPublishInput {
  sessionCombinedUrl?: string | null;
  rescuedCombinedUrl?: string | null;
  leftoverRenderUrl?: string | null;
  scenes?: YouTubeDraftPublishScene[] | null;
}

export interface YouTubeDraftPublishDecision {
  url: string | null;
  source: YouTubeDraftPublishSource;
  publishEnabled: boolean;
  publishLine: string | null;
  helperText: string | null;
}

const NONE: YouTubeDraftPublishDecision = {
  url: null,
  source: "none",
  publishEnabled: false,
  publishLine: null,
  helperText: null,
};

const COMBINE_HELPER = "Combine these scenes first.";

function normalizePublishUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readyDraftClips(scenes: YouTubeDraftPublishScene[]): YouTubeDraftPublishScene[] {
  return scenes.filter(
    (scene) => scene.enabled !== false && Boolean(normalizePublishUrl(scene.videoUrl)),
  );
}

export function selectYouTubeDraftPublishVideo(
  input: YouTubeDraftPublishInput,
): YouTubeDraftPublishDecision {
  try {
    const sessionCombinedUrl = normalizePublishUrl(input.sessionCombinedUrl);
    if (sessionCombinedUrl) {
      return {
        url: sessionCombinedUrl,
        source: "combined",
        publishEnabled: true,
        publishLine: "Publishing: combined video",
        helperText: null,
      };
    }

    if (!input.scenes?.length) {
      return NONE;
    }

    const ready = readyDraftClips(input.scenes);
    if (ready.length === 1) {
      const scene = ready[0];
      const url = normalizePublishUrl(scene.videoUrl);
      if (!url) {
        return NONE;
      }
      return {
        url,
        source: "scene_clip",
        publishEnabled: true,
        publishLine: `Publishing: scene ${scene.scene_number} clip`,
        helperText: null,
      };
    }

    if (ready.length >= 2) {
      return {
        url: null,
        source: "none",
        publishEnabled: false,
        publishLine: null,
        helperText: COMBINE_HELPER,
      };
    }

    return NONE;
  } catch (error) {
    console.error("[youtubeDraftPublishVideo] Failed to select publish video", {
      errorName: error instanceof Error ? error.name : "Error",
      hasSessionCombined: Boolean(input?.sessionCombinedUrl),
      hasRescuedCombined: Boolean(input?.rescuedCombinedUrl),
      hasLeftoverRender: Boolean(input?.leftoverRenderUrl),
      sceneCount: input?.scenes?.length ?? 0,
    });
    return NONE;
  }
}

export function youtubeDraftPublishLogMeta(
  decision: YouTubeDraftPublishDecision,
  options: {
    combinedFromThisSession: boolean;
    hasRescuedCombined: boolean;
    hasLeftoverRender: boolean;
  },
): Record<string, string | number | boolean> {
  return {
    publishVideoSource: decision.source,
    publishEnabled: decision.publishEnabled,
    combinedFromThisSession: options.combinedFromThisSession,
    ignoredRescuedCombined: options.hasRescuedCombined,
    ignoredLeftoverRender: options.hasLeftoverRender,
    ...youtubePublishSourceMeta(decision.url),
  };
}
