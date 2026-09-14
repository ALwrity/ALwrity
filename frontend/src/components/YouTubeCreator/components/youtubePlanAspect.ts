/**
 * Plan Your Video duration → default aspect. Reuses publish thumbnail 16/9 math.
 * A stored user ratio is never overwritten by a duration change.
 */

import type { DurationType } from "../constants";
import {
  youtubePublishDurationType,
  youtubeThumbnailAspectForDuration,
  type YouTubeThumbnailAspect,
} from "./youtubePublishThumbnail";

export type YouTubePlanAspect = YouTubeThumbnailAspect;

export const YOUTUBE_PLAN_ASPECT_OPTIONS: Array<{
  value: YouTubePlanAspect;
  label: string;
}> = [
  { value: "9:16", label: "9:16" },
  { value: "16:9", label: "16:9" },
];

export const YOUTUBE_PLAN_DURATION_PILLS: Array<{
  value: DurationType;
  label: string;
  hint: string;
}> = [
  { value: "shorts", label: "Shorts", hint: "Vertical bite-sized (≤60s)." },
  { value: "medium", label: "Medium", hint: "Quick explainers (1-4 min)." },
  { value: "long", label: "Long", hint: "Deep dives (4-10 min)." },
];

export function youtubePlanAspectFromDuration(
  durationType: string | undefined | null,
): YouTubePlanAspect {
  return youtubeThumbnailAspectForDuration(youtubePublishDurationType(durationType));
}

export function parseYouTubePlanAspect(
  value: unknown,
  durationType: string | undefined | null,
): YouTubePlanAspect {
  if (value === "16:9" || value === "9:16") {
    return value;
  }
  if (value != null && String(value).trim() !== "") {
    console.warn("[youtubePlanAspect] Unknown aspectRatio; using duration default", {
      requested: value,
    });
  }
  return youtubePlanAspectFromDuration(durationType);
}

export function youtubePlanDurationHint(durationType: DurationType): string {
  const pill = YOUTUBE_PLAN_DURATION_PILLS.find((item) => item.value === durationType);
  return pill?.hint ?? YOUTUBE_PLAN_DURATION_PILLS[1].hint;
}
