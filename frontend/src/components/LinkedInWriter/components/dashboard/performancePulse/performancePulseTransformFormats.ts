/**
 * Performance Pulse — "Transform to another format" targets (ordered, lock flags).
 */
import { getPerformanceContentTypeMeta } from "./contentTypeLabels";
import { getFormatTonalColors } from "./formatTonalPalette";
import type { PerformanceContentType } from "./types";

export interface PerformancePulseTransformFormat {
  type: PerformanceContentType;
  icon: string;
  label: string;
  bg: string;
  border: string;
  text: string;
  locked?: boolean;
}

const TRANSFORM_LABELS: Partial<Record<PerformanceContentType, string>> = {
  video_script: "Video Script",
};

/** Display order: Article → Video Script → Carousel */
const PULSE_TRANSFORM_ORDER: PerformanceContentType[] = [
  "article",
  "video_script",
  "carousel",
];

const PULSE_TRANSFORM_LOCKED = new Set<PerformanceContentType>([
  "video_script",
  "carousel",
]);

function buildPulseTransformFormat(
  type: PerformanceContentType,
): PerformancePulseTransformFormat {
  const meta = getPerformanceContentTypeMeta(type);
  return {
    type,
    icon: meta.icon,
    label: TRANSFORM_LABELS[type] ?? meta.label,
    ...getFormatTonalColors(type),
    locked: PULSE_TRANSFORM_LOCKED.has(type),
  };
}

export function isPerformancePulseTransformLocked(
  type: PerformanceContentType,
): boolean {
  return PULSE_TRANSFORM_LOCKED.has(type);
}

/** Targets for Pulse transform row — excludes source type, preserves order. */
export function getPerformancePulseTransformFormats(
  sourceType: PerformanceContentType,
): PerformancePulseTransformFormat[] {
  return PULSE_TRANSFORM_ORDER.filter((type) => type !== sourceType).map(
    buildPulseTransformFormat,
  );
}
