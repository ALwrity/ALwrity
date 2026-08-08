/**
 * User-facing labels and styling for Performance Pulse content-type badges.
 */
import type { PerformanceContentType } from "./types";

export interface PerformanceContentTypeMeta {
  label: string;
  icon: string;
  background: string;
  color: string;
}

export const PERFORMANCE_CONTENT_TYPE_META: Record<
  PerformanceContentType,
  PerformanceContentTypeMeta
> = {
  post: {
    label: "Post",
    icon: "📝",
    background: "#eff6ff",
    color: "#1d4ed8",
  },
  article: {
    label: "Article",
    icon: "📄",
    background: "#ecfdf5",
    color: "#047857",
  },
  carousel: {
    label: "Carousel",
    icon: "🎠",
    background: "#f5f3ff",
    color: "#6d28d9",
  },
  video_script: {
    label: "Video",
    icon: "🎬",
    background: "#fef2f2",
    color: "#b91c1c",
  },
};

export function getPerformanceContentTypeMeta(
  contentType: PerformanceContentType,
): PerformanceContentTypeMeta {
  return PERFORMANCE_CONTENT_TYPE_META[contentType];
}
