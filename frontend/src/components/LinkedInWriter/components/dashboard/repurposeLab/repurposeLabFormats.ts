/**
 * Repurpose Lab format buttons — ordered for Top Performers cards.
 * Video Script and Carousel are frontend-locked (Coming soon).
 */
import { getPerformanceContentTypeMeta } from "../performancePulse/contentTypeLabels";
import { getFormatTonalColors } from "../performancePulse/formatTonalPalette";
import type { PerformanceContentType } from "../performancePulse/types";

export interface RepurposeLabFormat {
  type: PerformanceContentType;
  icon: string;
  label: string;
  bg: string;
  border: string;
  text: string;
  locked?: boolean;
}

/** @deprecated Use FORMAT_ACTION_LOCKED_HINT from formatTonalPalette */
export const REPURPOSE_LAB_LOCKED_HINT =
  "Coming soon — this format will be available in a future update.";

function labFormat(
  type: PerformanceContentType,
  label: string,
  locked = false,
): RepurposeLabFormat {
  const meta = getPerformanceContentTypeMeta(type);
  return {
    type,
    icon: meta.icon,
    label,
    ...getFormatTonalColors(type),
    locked,
  };
}

/** Display order: New Post Angle → Article → Video Script → Carousel */
export const REPURPOSE_LAB_FORMATS: RepurposeLabFormat[] = [
  labFormat("post", "New Post Angle"),
  labFormat("article", "Article"),
  labFormat("video_script", "Video Script", true),
  labFormat("carousel", "Carousel", true),
];

export function isRepurposeLabFormatLocked(
  type: PerformanceContentType,
): boolean {
  return REPURPOSE_LAB_FORMATS.some((f) => f.type === type && f.locked);
}
