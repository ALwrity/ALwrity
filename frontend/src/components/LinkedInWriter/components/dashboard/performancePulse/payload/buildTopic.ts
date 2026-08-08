import type { LinkedInPost } from "../../../../../../services/postAnalyticsApi";
import type { PerformanceContentType } from "../types";
import {
  MAX_TOPIC_LEN,
  extractContentBullets,
  hasMeaningfulTitle,
  normalizeWhitespace,
  truncateWithEllipsis,
} from "./sharedTextUtils";

function topicFromBody(body: string): string {
  const firstLine =
    body.split(/\n+/).find((line) => line.trim())?.trim() ?? body;
  const normalized = normalizeWhitespace(firstLine);

  if (normalized.length <= MAX_TOPIC_LEN) {
    return normalized;
  }

  const sentenceMatch = normalized
    .slice(0, MAX_TOPIC_LEN)
    .match(/^(.+?[.!?…—–-])(?:\s|$)/);
  if (sentenceMatch?.[1]) {
    return truncateWithEllipsis(sentenceMatch[1].trim(), MAX_TOPIC_LEN);
  }

  return truncateWithEllipsis(normalized, MAX_TOPIC_LEN);
}

const DEFAULT_TOPIC: Record<PerformanceContentType, string> = {
  post: "LinkedIn post",
  article: "LinkedIn article",
  carousel: "LinkedIn carousel",
  video_script: "LinkedIn video script",
};

/** Topic for Quick Create — format-aware extraction. */
export function buildPerformanceTopic(
  post: LinkedInPost,
  contentType: PerformanceContentType,
): string {
  const body = post.text?.trim() ?? "";
  const title = post.title?.trim() ?? "";

  if (contentType === "article" && hasMeaningfulTitle(title)) {
    return truncateWithEllipsis(title, MAX_TOPIC_LEN);
  }

  if (body) {
    return topicFromBody(body);
  }

  if (hasMeaningfulTitle(title)) {
    return truncateWithEllipsis(title, MAX_TOPIC_LEN);
  }

  return DEFAULT_TOPIC[contentType];
}

/** @deprecated Use buildPerformanceTopic — post-only alias for legacy tests. */
export function extractPostTopic(post: LinkedInPost): string {
  return buildPerformanceTopic(post, "post");
}

export { extractContentBullets };
