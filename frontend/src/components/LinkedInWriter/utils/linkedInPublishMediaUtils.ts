/**
 * Client-side utilities for LinkedIn publish media attachment (Phase 1 UI).
 */

import {
  extractLinkedInImageId,
  splitDraftByImageMarkdown,
} from './linkedInImageDraftUtils';
import {
  LINKEDIN_PUBLISH_ACCEPTED_IMAGE_TYPES,
  LINKEDIN_PUBLISH_MAX_IMAGE_BYTES,
} from './linkedInPublishMediaConstants';

export type LinkedInPublishMediaSource = 'ai' | 'upload';

export interface LinkedInDraftImageAttachment {
  source: 'ai';
  imageId: string;
  imageUrl: string;
  alt: string;
}

export interface LinkedInUploadImageAttachment {
  source: 'upload';
  localFile: File;
  previewUrl: string;
  fileName: string;
}

export type LinkedInPublishMediaAttachment =
  | LinkedInDraftImageAttachment
  | LinkedInUploadImageAttachment;

export interface LinkedInPublishImageValidationResult {
  valid: boolean;
  error?: string;
}

/** Extract all LinkedIn image IDs referenced in draft markdown. */
export function extractPublishImageIds(draft: string): string[] {
  return splitDraftByImageMarkdown(draft)
    .filter((segment) => segment.type === 'image' && segment.imageId)
    .map((segment) => (segment.type === 'image' ? segment.imageId : null))
    .filter((id): id is string => Boolean(id));
}

/** Return the last AI-generated image segment from a draft (publish v1 uses one image). */
export function getLastDraftImageForPublish(draft: string): LinkedInDraftImageAttachment | null {
  const imageSegments = splitDraftByImageMarkdown(draft).filter(
    (segment) => segment.type === 'image',
  );

  if (imageSegments.length === 0) return null;

  const last = imageSegments[imageSegments.length - 1];
  if (last.type !== 'image') return null;

  const imageId = last.imageId || extractLinkedInImageId(last.url);
  if (!imageId) return null;

  return {
    source: 'ai',
    imageId,
    imageUrl: last.url,
    alt: last.alt,
  };
}

/**
 * Resolve the media attachment to send on publish.
 * Always re-reads the draft so preview/editor images are not missed.
 */
export function resolvePublishMediaAttachment(
  draft: string,
  hookAttachment: LinkedInPublishMediaAttachment | null,
): LinkedInPublishMediaAttachment | null {
  if (hookAttachment?.source === 'upload' && hookAttachment.localFile) {
    return hookAttachment;
  }

  const fromDraft = getLastDraftImageForPublish(draft);
  if (fromDraft) {
    return fromDraft;
  }

  return hookAttachment;
}

/** Validate a local image file before attach (client-side preflight). */
export function validatePublishImageFile(file: File): LinkedInPublishImageValidationResult {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const mime = file.type.toLowerCase();
  const accepted = LINKEDIN_PUBLISH_ACCEPTED_IMAGE_TYPES as readonly string[];
  if (!accepted.includes(mime)) {
    return { valid: false, error: 'Use PNG, JPEG, GIF, or WebP images only.' };
  }

  if (file.size > LINKEDIN_PUBLISH_MAX_IMAGE_BYTES) {
    return { valid: false, error: 'Image must be under 8 MB.' };
  }

  if (file.size === 0) {
    return { valid: false, error: 'Selected file is empty.' };
  }

  return { valid: true };
}

/** Build publish payload metadata from current attachment (UI preview). */
export function describePublishMediaAttachment(
  attachment: LinkedInPublishMediaAttachment | null,
): string {
  if (!attachment) return 'No image attached';

  if (attachment.source === 'ai') {
    return `AI image (${attachment.imageId.slice(0, 8)}…)`;
  }

  return `Uploaded image (${attachment.fileName})`;
}
