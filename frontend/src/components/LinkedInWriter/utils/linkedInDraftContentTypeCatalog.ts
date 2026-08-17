/**
 * Canonical LinkedIn draft content-type catalog — shared by save, read, and session storage.
 */

export type LinkedInDraftContentType =
  | "post"
  | "article"
  | "carousel"
  | "video_script";

export const LINKEDIN_DRAFT_CONTENT_TYPES: LinkedInDraftContentType[] = [
  "post",
  "article",
  "carousel",
  "video_script",
];

export const DEFAULT_DRAFT_CONTENT_TYPE: LinkedInDraftContentType = "post";

/** Persisted value in asset_metadata.content_type */
export const STORAGE_CONTENT_TYPE_BY_FORMAT: Record<
  LinkedInDraftContentType,
  string
> = {
  post: "linkedin_post",
  article: "linkedin_article",
  carousel: "linkedin_carousel",
  video_script: "linkedin_video_script",
};

/** Primary format tag written when saving to the asset library */
export const FORMAT_TAG_BY_TYPE: Record<LinkedInDraftContentType, string> = {
  post: "linkedin_post",
  article: "linkedin_article",
  carousel: "linkedin_carousel",
  video_script: "linkedin_video_script",
};

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

const EXPLICIT_FORMAT_TAGS = new Set(Object.values(FORMAT_TAG_BY_TYPE));

/** Legacy plain tags (e.g. Format Transformer saves) — not linkedin_* prefixed. */
const LEGACY_PLAIN_FORMAT_TYPES = new Set<LinkedInDraftContentType>([
  "article",
  "carousel",
  "video_script",
]);

/** Normalize raw strings (aliases, casing, underscores) to a draft format. */
export function normalizeDraftContentType(
  raw: unknown,
): LinkedInDraftContentType | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
  const fromAlias = CONTENT_TYPE_ALIASES[key];
  if (fromAlias) return fromAlias;
  if (LINKEDIN_DRAFT_CONTENT_TYPES.includes(key as LinkedInDraftContentType)) {
    return key as LinkedInDraftContentType;
  }
  return null;
}

export function toStorageContentType(
  type: LinkedInDraftContentType,
): string {
  return STORAGE_CONTENT_TYPE_BY_FORMAT[type];
}

export function toFormatTag(type: LinkedInDraftContentType): string {
  return FORMAT_TAG_BY_TYPE[type];
}

export interface DraftContentTypeResolvable {
  tags?: string[];
  source_module?: string;
  asset_type?: string;
  asset_metadata?: {
    content_type?: string;
    [key: string]: unknown;
  };
}

function resolveFormatFromTags(
  tags: string[] | undefined,
): LinkedInDraftContentType | null {
  let legacyPlain: LinkedInDraftContentType | null = null;

  for (const tag of tags ?? []) {
    const normalizedTag = tag.trim().toLowerCase().replace(/\s+/g, "_");
    if (EXPLICIT_FORMAT_TAGS.has(normalizedTag)) {
      const resolved = normalizeDraftContentType(normalizedTag);
      if (resolved) return resolved;
    }
    if (!legacyPlain) {
      const resolved = normalizeDraftContentType(normalizedTag);
      if (resolved && LEGACY_PLAIN_FORMAT_TYPES.has(resolved)) {
        legacyPlain = resolved;
      }
    }
  }

  return legacyPlain;
}

/**
 * Resolve draft format from a saved asset.
 * Prefers linkedin_* format tags, then legacy plain tags, then metadata.
 */
export function resolveDraftContentTypeFromAsset(
  asset: DraftContentTypeResolvable,
): LinkedInDraftContentType | null {
  const fromTags = resolveFormatFromTags(asset.tags);
  const fromMeta = normalizeDraftContentType(asset.asset_metadata?.content_type);

  if (fromTags) return fromTags;
  if (fromMeta) return fromMeta;

  if (
    asset.source_module === "linkedin_writer" &&
    asset.asset_type === "text"
  ) {
    return "post";
  }

  return null;
}
