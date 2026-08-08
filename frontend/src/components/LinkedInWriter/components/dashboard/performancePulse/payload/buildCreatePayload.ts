import type { LinkedInPost } from "../../../../../../services/postAnalyticsApi";
import type { PerformanceContentType } from "../types";
import { buildPerformanceOutlineKeyPoints } from "./buildOutlineKeyPoints";
import { buildPerformanceReferenceContext } from "./buildReferenceContext";
import { buildPerformanceTopic } from "./buildTopic";
import type {
  PerformancePulseCreateMode,
  PerformancePulseCreatePayload,
} from "./types";

export function buildPerformancePulseCreatePayload(
  post: LinkedInPost,
  mode: PerformancePulseCreateMode,
  contentType: PerformanceContentType,
): PerformancePulseCreatePayload {
  return {
    topic: buildPerformanceTopic(post, contentType),
    key_points: buildPerformanceOutlineKeyPoints(post, mode, contentType),
    reference_context: buildPerformanceReferenceContext(post, mode, contentType),
    reference_mode: mode,
  };
}

/** @deprecated Use buildPerformancePulseCreatePayload — post-only alias. */
export function buildPostPulseCreatePayload(
  post: LinkedInPost,
  mode: PerformancePulseCreateMode,
): PerformancePulseCreatePayload {
  return buildPerformancePulseCreatePayload(post, mode, "post");
}

export function toQuickCreateContentType(
  contentType: PerformanceContentType,
): PerformanceContentType {
  return contentType;
}
