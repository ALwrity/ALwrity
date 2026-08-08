/**
 * Infer ALwrity content format from a LinkedIn analytics item.
 * Defaults to "post" when uncertain — preserves legacy Performance Pulse behavior.
 */
import type { LinkedInPost, PostAttachment } from "../../../../../services/postAnalyticsApi";
import type { PerformanceContentType, PerformancePulseItem } from "./types";

const VIDEO_TYPES = new Set(["video", "vid"]);
const DOCUMENT_TYPES = new Set(["file", "document", "doc", "pdf"]);
const GENERIC_TITLES = new Set(["post", "my post", "linkedin post"]);

/** LinkedIn long-form / article URL patterns in post text. */
const ARTICLE_URL_PATTERN =
  /https?:\/\/(?:[\w-]+\.)?(?:linkedin\.com\/pulse|medium\.com|substack\.com)\/\S+/i;

const ARTICLE_BODY_MIN_LEN = 1500;
const ARTICLE_TITLE_BODY_MIN_LEN = 400;

function normalizeAttachmentType(type?: string): string {
  return (type ?? "img").trim().toLowerCase();
}

function hasAttachmentKind(
  attachments: PostAttachment[] | undefined,
  kinds: Set<string>,
): boolean {
  if (!attachments?.length) return false;
  return attachments.some((att) => kinds.has(normalizeAttachmentType(att.type)));
}

function hasMeaningfulTitle(title?: string | null): boolean {
  const trimmed = title?.trim() ?? "";
  if (!trimmed) return false;
  return !GENERIC_TITLES.has(trimmed.toLowerCase());
}

function looksLikeArticle(post: LinkedInPost): boolean {
  const body = post.text?.trim() ?? "";
  if (ARTICLE_URL_PATTERN.test(body)) return true;
  if (body.length >= ARTICLE_BODY_MIN_LEN) return true;
  if (hasMeaningfulTitle(post.title) && body.length >= ARTICLE_TITLE_BODY_MIN_LEN) {
    return true;
  }
  return false;
}

/**
 * Classify a LinkedIn post for Performance Pulse display and future action routing.
 * Priority: video → carousel (document) → article heuristics → post.
 */
export function inferPerformanceContentType(
  post: LinkedInPost,
): PerformanceContentType {
  if (hasAttachmentKind(post.attachments, VIDEO_TYPES)) {
    return "video_script";
  }
  if (hasAttachmentKind(post.attachments, DOCUMENT_TYPES)) {
    return "carousel";
  }
  if (looksLikeArticle(post)) {
    return "article";
  }
  return "post";
}

export function toPerformancePulseItem(post: LinkedInPost): PerformancePulseItem {
  return {
    post,
    contentType: inferPerformanceContentType(post),
  };
}
