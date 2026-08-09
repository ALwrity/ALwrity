/**
 * Cross-format transform options for Performance Pulse and Repurpose Lab.
 */
import { getPerformanceContentTypeMeta } from "./contentTypeLabels";
import type { PerformanceContentType } from "./types";

export interface PerformanceTransformFormat {
  type: PerformanceContentType;
  icon: string;
  label: string;
  accent: string;
}

export const PERFORMANCE_TRANSFORM_FORMATS: PerformanceTransformFormat[] = [
  {
    type: "carousel",
    icon: getPerformanceContentTypeMeta("carousel").icon,
    label: getPerformanceContentTypeMeta("carousel").label,
    accent: "#8b5cf6",
  },
  {
    type: "article",
    icon: getPerformanceContentTypeMeta("article").icon,
    label: getPerformanceContentTypeMeta("article").label,
    accent: "#057642",
  },
  {
    type: "video_script",
    icon: getPerformanceContentTypeMeta("video_script").icon,
    label: "Video Script",
    accent: "#dc2626",
  },
  {
    type: "post",
    icon: getPerformanceContentTypeMeta("post").icon,
    label: "New Post Angle",
    accent: "#0a66c2",
  },
];

/** Repurpose Lab row actions — ordered formats with frontend lock flags. */
export {
  REPURPOSE_LAB_FORMATS,
  isRepurposeLabFormatLocked,
} from "../repurposeLab/repurposeLabFormats";
export type { RepurposeLabFormat } from "../repurposeLab/repurposeLabFormats";

export function getTransformFormatsForSource(
  sourceType: PerformanceContentType,
): PerformanceTransformFormat[] {
  return PERFORMANCE_TRANSFORM_FORMATS.filter(
    (format) => format.type !== sourceType,
  );
}
