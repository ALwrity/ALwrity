/**
 * Session persistence and event helpers for LinkedIn Studio draft content type.
 */

import {
  DEFAULT_DRAFT_CONTENT_TYPE,
  normalizeDraftContentType,
  type LinkedInDraftContentType,
} from "./linkedInDraftContentTypeCatalog";

export type { LinkedInDraftContentType };
export { DEFAULT_DRAFT_CONTENT_TYPE, normalizeDraftContentType };

export const DRAFT_CONTENT_TYPE_SESSION_KEY = "li_draft_content_type";

const LOG_PREFIX = "[LinkedInDraftContentType]";

export interface ParsedUpdateDraftDetail {
  content: string;
  contentType?: LinkedInDraftContentType;
}

/** Map LinkedIn Writer action names to draft content types. */
export function contentTypeFromWriterAction(
  action: string | null | undefined,
): LinkedInDraftContentType | null {
  if (!action) return null;
  const normalized = action.toLowerCase();
  if (normalized.includes("article")) return "article";
  if (normalized.includes("carousel")) return "carousel";
  if (normalized.includes("videoscript") || normalized.includes("video_script")) {
    return "video_script";
  }
  if (normalized.includes("post")) return "post";
  return null;
}

/** Parse linkedinwriter:updateDraft detail (legacy string or object). */
export function parseUpdateDraftDetail(detail: unknown): ParsedUpdateDraftDetail {
  if (typeof detail === "string") {
    return { content: detail };
  }
  if (detail && typeof detail === "object" && "content" in detail) {
    const record = detail as { content?: unknown; contentType?: unknown };
    const content =
      typeof record.content === "string" ? record.content : "";
    const contentType = normalizeDraftContentType(record.contentType);
    return contentType ? { content, contentType } : { content };
  }
  return { content: "" };
}

/** Read persisted draft content type from sessionStorage. */
export function loadDraftContentType(): LinkedInDraftContentType | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_CONTENT_TYPE_SESSION_KEY);
    if (!raw) return null;
    const normalized = normalizeDraftContentType(raw);
    if (!normalized) {
      console.warn(`${LOG_PREFIX} invalid stored value, ignoring`, { raw });
      return null;
    }
    console.debug(`${LOG_PREFIX} restored from sessionStorage`, {
      contentType: normalized,
    });
    return normalized;
  } catch (error) {
    console.warn(`${LOG_PREFIX} failed to read sessionStorage`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Persist draft content type to sessionStorage. */
export function saveDraftContentType(type: LinkedInDraftContentType): void {
  try {
    sessionStorage.setItem(DRAFT_CONTENT_TYPE_SESSION_KEY, type);
    console.debug(`${LOG_PREFIX} saved to sessionStorage`, {
      contentType: type,
    });
  } catch (error) {
    console.warn(`${LOG_PREFIX} failed to write sessionStorage`, {
      contentType: type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Remove persisted draft content type. */
export function clearDraftContentTypeStorage(): void {
  try {
    sessionStorage.removeItem(DRAFT_CONTENT_TYPE_SESSION_KEY);
    console.debug(`${LOG_PREFIX} cleared sessionStorage`);
  } catch (error) {
    console.warn(`${LOG_PREFIX} failed to clear sessionStorage`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Dispatch draft update with optional content type for external entry points. */
export function dispatchLinkedInDraftUpdate(
  content: string,
  contentType?: LinkedInDraftContentType,
): void {
  const detail =
    contentType != null
      ? { content, contentType }
      : content;
  window.dispatchEvent(
    new CustomEvent("linkedinwriter:updateDraft", { detail }),
  );
}
