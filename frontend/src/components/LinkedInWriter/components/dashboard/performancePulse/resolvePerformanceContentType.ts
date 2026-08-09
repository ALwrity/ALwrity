/**
 * Resolve Performance Pulse content type — API-first, inference fallback.
 */
import type { LinkedInPost } from "../../../../../services/postAnalyticsApi";
import type { PerformanceContentType } from "./types";
import { inferPerformanceContentType } from "./inferContentType";

const VALID_TYPES = new Set<PerformanceContentType>([
  "post",
  "article",
  "carousel",
  "video_script",
]);

export function resolvePerformanceContentType(
  post: LinkedInPost,
): PerformanceContentType {
  const fromApi = post.content_type;
  if (fromApi && VALID_TYPES.has(fromApi as PerformanceContentType)) {
    return fromApi as PerformanceContentType;
  }
  return inferPerformanceContentType(post);
}
