/**
 * Shared Performance Pulse → Quick Create routing (Phase 2.5: Repurpose Lab alignment).
 */
import type { LinkedInPost } from "../../../../../services/postAnalyticsApi";
import { openQuickCreateFromWedge } from "../engagementWedgeNavigation";
import type { QuickCreateReturnTarget } from "../workflowWedgeNavigation";
import { buildPerformancePulseCreatePayload, type PerformancePulseCreateMode } from "./payload";
import type { PerformanceContentType } from "./types";

export function coercePerformanceContentType(
  type: string,
): PerformanceContentType {
  if (
    type === "post" ||
    type === "article" ||
    type === "carousel" ||
    type === "video_script"
  ) {
    return type;
  }
  return "post";
}

export function openPerformanceContentInQuickCreate(
  post: LinkedInPost,
  mode: PerformancePulseCreateMode,
  targetType: PerformanceContentType | string,
  returnTo: QuickCreateReturnTarget,
): void {
  const contentType = coercePerformanceContentType(targetType);
  const payload = buildPerformancePulseCreatePayload(post, mode, contentType);

  openQuickCreateFromWedge({
    type: contentType,
    topic: payload.topic,
    key_points: payload.key_points,
    reference_context: payload.reference_context,
    reference_mode: payload.reference_mode,
    returnTo,
  });
}

/** Repurpose Lab cross-format shortcut — always uses repurpose mode. */
export function openRepurposeLabInQuickCreate(
  post: LinkedInPost,
  targetType: PerformanceContentType | string,
  returnTo: QuickCreateReturnTarget,
): void {
  openPerformanceContentInQuickCreate(post, "repurpose", targetType, returnTo);
}
