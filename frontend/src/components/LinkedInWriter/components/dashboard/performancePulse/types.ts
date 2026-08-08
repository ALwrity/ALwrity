/**
 * Performance Pulse — shared types (Phase 1: inference + display).
 */
import type { LinkedInPost } from "../../../../../services/postAnalyticsApi";

export type PerformanceContentType =
  | "post"
  | "article"
  | "carousel"
  | "video_script";

/** Content filter for Performance Pulse tabs (Phase 4). */
export type PerformancePulseFilter = "all" | PerformanceContentType;

export interface PerformancePulseItem {
  post: LinkedInPost;
  contentType: PerformanceContentType;
}

export type PerformancePulseFilterCounts = Record<
  PerformancePulseFilter,
  number
>;
