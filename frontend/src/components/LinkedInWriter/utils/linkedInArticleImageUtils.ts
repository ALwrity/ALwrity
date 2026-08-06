/**
 * Article draft image helpers — reuse post editor image block storage.
 */

import {
  createEditorImageBlock,
  type LinkedInEditorImageBlock,
} from "./linkedInEditorDraftUtils";
import { extractLinkedInImageId } from "./linkedInImageDraftUtils";
import type { LinkedInArticleDraftState } from "./linkedInArticleDraftTypes";

const LOG_PREFIX = "[LinkedInArticleImage]";

export function createArticleImageBlockFromUrl(
  imageUrl: string,
  alt = "Article image",
): LinkedInEditorImageBlock {
  const imageId = extractLinkedInImageId(imageUrl) || imageUrl;
  return createEditorImageBlock(imageUrl, imageId, alt);
}

export function appendImageToArticleDraftState(
  state: LinkedInArticleDraftState,
  block: LinkedInEditorImageBlock,
): LinkedInArticleDraftState {
  const images = [...(state.images || []), block];
  console.log(`${LOG_PREFIX} appended image to article draft`, {
    imageId: block.imageId || block.id,
    imageCount: images.length,
  });
  return { ...state, images };
}

export function removeImageFromArticleDraftState(
  state: LinkedInArticleDraftState,
  imageId: string,
): LinkedInArticleDraftState {
  const images = (state.images || []).filter((image) => image.id !== imageId);
  console.log(`${LOG_PREFIX} removed image from article draft`, {
    imageId,
    imageCount: images.length,
  });
  return { ...state, images };
}

/** Move legacy coverImageUrl into the shared images strip. */
export function migrateArticleCoverToImages(
  state: LinkedInArticleDraftState,
): LinkedInArticleDraftState {
  const coverUrl = state.coverImageUrl?.trim();
  if (!coverUrl) return state;

  const existing = state.images || [];
  if (existing.some((image) => image.url === coverUrl)) {
    return { ...state, coverImageUrl: undefined };
  }

  console.log(`${LOG_PREFIX} migrated legacy cover into images strip`);
  return {
    ...state,
    coverImageUrl: undefined,
    images: [...existing, createArticleImageBlockFromUrl(coverUrl, "Article image")],
  };
}

export function normalizeArticleImages(
  state: LinkedInArticleDraftState,
): LinkedInArticleDraftState {
  return migrateArticleCoverToImages({
    ...state,
    images: state.images || [],
  });
}
