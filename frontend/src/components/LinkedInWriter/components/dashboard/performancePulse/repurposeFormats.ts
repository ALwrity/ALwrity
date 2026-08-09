import { getPerformanceContentTypeMeta } from "./contentTypeLabels";
import { getFormatTonalColors } from "./formatTonalPalette";
import type { PerformanceContentType } from "./types";

export interface PerformanceTransformFormat {
  type: PerformanceContentType;
  icon: string;
  label: string;
  bg: string;
  border: string;
  text: string;
}

function buildTransformFormat(
  type: PerformanceContentType,
  labelOverride?: string,
): PerformanceTransformFormat {
  const meta = getPerformanceContentTypeMeta(type);
  const tonal = getFormatTonalColors(type);
  return {
    type,
    icon: meta.icon,
    label: labelOverride ?? meta.label,
    ...tonal,
  };
}

/** @deprecated Use getPerformancePulseTransformFormats for Pulse UI. */
export const PERFORMANCE_TRANSFORM_FORMATS: PerformanceTransformFormat[] = [
  buildTransformFormat("article"),
  buildTransformFormat("video_script", "Video Script"),
  buildTransformFormat("carousel"),
  buildTransformFormat("post", "New Post Angle"),
];

export {
  getPerformancePulseTransformFormats,
  isPerformancePulseTransformLocked,
} from "./performancePulseTransformFormats";
export type { PerformancePulseTransformFormat } from "./performancePulseTransformFormats";

/** Repurpose Lab row actions — ordered formats with frontend lock flags. */
export {
  REPURPOSE_LAB_FORMATS,
  isRepurposeLabFormatLocked,
} from "../repurposeLab/repurposeLabFormats";
export type { RepurposeLabFormat } from "../repurposeLab/repurposeLabFormats";

/** @deprecated Prefer getPerformancePulseTransformFormats for Pulse transform row. */
export function getTransformFormatsForSource(
  sourceType: PerformanceContentType,
): PerformanceTransformFormat[] {
  return PERFORMANCE_TRANSFORM_FORMATS.filter(
    (format) => format.type !== sourceType,
  );
}
