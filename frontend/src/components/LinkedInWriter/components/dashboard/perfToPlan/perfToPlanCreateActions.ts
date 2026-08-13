import type { PerformanceContentType } from "../performancePulse/types";
import { getPerformanceContentTypeMeta } from "../performancePulse/contentTypeLabels";
import { getFormatTonalColors } from "../performancePulse/formatTonalPalette";
import { PERF_TO_PLAN_LOCKED_HINT } from "./perfToPlanConfig";
import type { RemixIdea } from "./perfToPlanIdeas";
import { REMIX_ANGLES } from "./perfToPlanConfig";

export interface PerfToPlanCreateActionDef {
  type: PerformanceContentType;
  label: string;
  locked: boolean;
}

/** Post + Article unlocked; Carousel + Video locked (grey + lock icon). */
export const PERF_TO_PLAN_CREATE_ACTIONS: PerfToPlanCreateActionDef[] = [
  { type: "post", label: "Create Post", locked: false },
  { type: "article", label: "As Article", locked: false },
  { type: "carousel", label: "As Carousel", locked: true },
  { type: "video_script", label: "As Video", locked: true },
];

export function buildPerfToPlanKeyPoints(
  idea: RemixIdea,
  remixAngle: string,
  contentType: PerformanceContentType,
): string {
  if (contentType === "post" || contentType === "article") {
    return `${remixAngle}. Original context: ${idea.sourcePost}`;
  }
  return idea.sourcePost;
}

export function getPerfToPlanActionPresentation(
  action: PerfToPlanCreateActionDef,
): {
  icon: string;
  colors: ReturnType<typeof getFormatTonalColors>;
  lockedHint: string;
} {
  const meta = getPerformanceContentTypeMeta(action.type);
  return {
    icon: meta.icon,
    colors: getFormatTonalColors(action.type),
    lockedHint: PERF_TO_PLAN_LOCKED_HINT,
  };
}

export function remixAngleForIndex(index: number): string {
  return REMIX_ANGLES[index % REMIX_ANGLES.length];
}
