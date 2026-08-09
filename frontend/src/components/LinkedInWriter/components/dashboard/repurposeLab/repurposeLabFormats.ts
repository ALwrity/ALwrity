/**
 * Repurpose Lab format buttons — ordered for Top Performers cards.
 * Video Script and Carousel are frontend-locked (Coming soon).
 */
import { getPerformanceContentTypeMeta } from "../performancePulse/contentTypeLabels";
import type { PerformanceContentType } from "../performancePulse/types";

export interface RepurposeLabFormat {
  type: PerformanceContentType;
  icon: string;
  label: string;
  /** Soft tonal palette — easier on the eyes than solid fills. */
  bg: string;
  border: string;
  text: string;
  locked?: boolean;
}

export const REPURPOSE_LAB_LOCKED_HINT =
  "Coming soon — this format will be available in a future update.";

/** Display order: New Post Angle → Article → Video Script → Carousel */
export const REPURPOSE_LAB_FORMATS: RepurposeLabFormat[] = [
  {
    type: "post",
    icon: getPerformanceContentTypeMeta("post").icon,
    label: "New Post Angle",
    bg: "#eff6ff",
    border: "#93c5fd",
    text: "#1d4ed8",
  },
  {
    type: "article",
    icon: getPerformanceContentTypeMeta("article").icon,
    label: "Article",
    bg: "#ecfdf5",
    border: "#6ee7b7",
    text: "#047857",
  },
  {
    type: "video_script",
    icon: getPerformanceContentTypeMeta("video_script").icon,
    label: "Video Script",
    bg: "#fff1f2",
    border: "#fecdd3",
    text: "#be123c",
    locked: true,
  },
  {
    type: "carousel",
    icon: getPerformanceContentTypeMeta("carousel").icon,
    label: "Carousel",
    bg: "#f5f3ff",
    border: "#c4b5fd",
    text: "#6d28d9",
    locked: true,
  },
];

export function isRepurposeLabFormatLocked(
  type: PerformanceContentType,
): boolean {
  return REPURPOSE_LAB_FORMATS.some((f) => f.type === type && f.locked);
}
