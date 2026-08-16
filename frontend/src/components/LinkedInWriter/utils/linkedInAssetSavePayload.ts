/**
 * Pure helpers for building LinkedIn content-asset save payloads.
 */
import {
  normalizeDraftContentType,
  toFormatTag,
  toStorageContentType,
  type LinkedInDraftContentType,
} from "./linkedInDraftContentTypeCatalog";

export interface BuildLinkedInAssetSavePayloadInput {
  title: string;
  content: string;
  topic?: string;
  /** Creation format — source of truth (not inferred from word count). */
  contentType?: LinkedInDraftContentType;
  tags?: string[];
  assetMetadata?: Record<string, unknown>;
}

export interface LinkedInAssetSavePayload {
  asset_type: "text";
  source_module: "linkedin_writer";
  filename: string;
  file_url: string;
  title: string;
  description: string;
  prompt: string;
  tags: string[];
  asset_metadata: {
    platform: "linkedin";
    content_type: string;
    content: string;
    word_count: number;
    [key: string]: unknown;
  };
}

export function resolveSaveContentType(
  contentType: LinkedInDraftContentType | undefined,
  tags?: string[],
  assetMetadata?: Record<string, unknown>,
): LinkedInDraftContentType {
  const explicit =
    contentType ??
    normalizeDraftContentType(assetMetadata?.content_type) ??
    null;

  if (explicit) return explicit;

  for (const tag of tags ?? []) {
    const fromTag = normalizeDraftContentType(tag);
    if (fromTag) return fromTag;
  }

  return "post";
}

export function buildLinkedInAssetSavePayload(
  input: BuildLinkedInAssetSavePayloadInput,
  filename: string,
): LinkedInAssetSavePayload {
  const resolvedType = resolveSaveContentType(
    input.contentType,
    input.tags,
    input.assetMetadata,
  );
  const formatTag = toFormatTag(resolvedType);
  const extraTags = (input.tags ?? []).filter(
    (tag) => normalizeDraftContentType(tag) !== resolvedType,
  );

  const { content_type: _ignored, ...restMetadata } = input.assetMetadata ?? {};

  return {
    asset_type: "text",
    source_module: "linkedin_writer",
    filename,
    file_url: `linkedin://posts/${filename}`,
    title: input.title,
    description: input.content,
    prompt: input.topic || "",
    tags: ["linkedin", "social", "ai_generated", formatTag, ...extraTags],
    asset_metadata: {
      platform: "linkedin",
      content: input.content,
      word_count: input.content ? input.content.split(/\s+/).length : 0,
      ...restMetadata,
      content_type: toStorageContentType(resolvedType),
    },
  };
}

export function buildLinkedInAssetFilename(title: string): string {
  const safeTitle = (title || "linkedin-post")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
  return `${safeTitle}-${Date.now()}.txt`;
}
