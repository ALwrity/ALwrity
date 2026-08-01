/**
 * Helpers for Publish wedge — My Drafts library filtering.
 */

export type LinkedInDraftContentType =
  | "post"
  | "article"
  | "carousel"
  | "video_script";

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

const ALLOWED_CONTENT_TYPES: LinkedInDraftContentType[] = [
  "post",
  "article",
  "carousel",
  "video_script",
];

const CONTENT_TYPE_ALIASES: Record<string, LinkedInDraftContentType> = {
  post: "post",
  linkedin_post: "post",
  article: "article",
  linkedin_article: "article",
  carousel: "carousel",
  linkedin_carousel: "carousel",
  video_script: "video_script",
  video: "video_script",
  linkedin_video_script: "video_script",
};

const MIN_CONTENT_CHARS = 60;

export function getDraftAssetContent(asset: LinkedInDraftAsset): string {
  return (asset.asset_metadata?.content || asset.description || "").trim();
}

function normalizeContentType(raw: string | undefined): LinkedInDraftContentType | null {
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/\s+/g, "_");
  return CONTENT_TYPE_ALIASES[key] ?? null;
}

export function getDraftContentType(
  asset: LinkedInDraftAsset,
): LinkedInDraftContentType | null {
  const fromMeta = normalizeContentType(asset.asset_metadata?.content_type);
  if (fromMeta) return fromMeta;

  for (const tag of asset.tags ?? []) {
    const fromTag = normalizeContentType(tag);
    if (fromTag) return fromTag;
  }

  if (
    asset.source_module === "linkedin_writer" &&
    asset.asset_type === "text"
  ) {
    return "post";
  }

  return null;
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
  if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
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
