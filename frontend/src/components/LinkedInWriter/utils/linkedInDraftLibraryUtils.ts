/**
 * Helpers for Publish wedge — My Drafts library filtering.
 */

import {
  LINKEDIN_DRAFT_CONTENT_TYPES,
  normalizeDraftContentType,
  resolveDraftContentTypeFromAsset,
  type LinkedInDraftContentType,
} from "./linkedInDraftContentTypeCatalog";

export type { LinkedInDraftContentType };

export interface LinkedInDraftAsset {
  id: string;
  title: string;
  description: string;
  created_at: string;
  prompt?: string;
  tags?: string[];
  source_module?: string;
  asset_type?: string;
  asset_metadata?: {
    content?: string;
    content_type?: string;
    word_count?: number;
    [key: string]: unknown;
  };
}

const MIN_CONTENT_CHARS = 60;

export function getDraftAssetContent(asset: LinkedInDraftAsset): string {
  return (asset.asset_metadata?.content || asset.description || "").trim();
}

/** Resolve format from creation metadata/tags — not from word count. */
export function getDraftContentType(
  asset: LinkedInDraftAsset,
): LinkedInDraftContentType | null {
  return resolveDraftContentTypeFromAsset(asset);
}

export function hasDraftTopic(asset: LinkedInDraftAsset): boolean {
  const title = (asset.title || "").trim();
  if (!title || title.toLowerCase() === "untitled draft") return false;

  const topic = (asset.prompt || "").trim();
  if (topic && topic.length >= 3) return true;

  return title.length >= 3;
}

export function hasDraftGeneratedContent(asset: LinkedInDraftAsset): boolean {
  const content = getDraftAssetContent(asset);
  if (!content || content.length < MIN_CONTENT_CHARS) return false;

  const title = (asset.title || "").trim();
  if (content === title) return false;

  const wordCount = asset.asset_metadata?.word_count;
  if (typeof wordCount === "number" && wordCount < 10) return false;

  return content.split(/\s+/).filter(Boolean).length >= 10;
}

/** Drafts with a topic and generated body for supported LinkedIn formats. */
export function isCompleteLinkedInDraft(asset: LinkedInDraftAsset): boolean {
  const contentType = getDraftContentType(asset);
  if (!contentType || !LINKEDIN_DRAFT_CONTENT_TYPES.includes(contentType)) {
    return false;
  }
  return hasDraftTopic(asset) && hasDraftGeneratedContent(asset);
}

export function filterCompleteLinkedInDrafts(
  assets: LinkedInDraftAsset[],
  limit = 5,
): LinkedInDraftAsset[] {
  return assets.filter(isCompleteLinkedInDraft).slice(0, limit);
}