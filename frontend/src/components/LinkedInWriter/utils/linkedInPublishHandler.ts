/**
 * Shared LinkedIn publish orchestration (Phase 3 — text + optional image).
 */

import { publishLinkedInPost } from '../../../api/linkedinSocial';
import { publishLinkedInPostWithFile } from '../../../api/linkedinPublishApi';
import type { LinkedInPublishPostResponse } from '../../../api/linkedinSocial';
import type {
  LinkedInPublishMediaAttachment,
  LinkedInPublishMediaSource,
} from './linkedInPublishMediaUtils';
import { resolvePublishMediaAttachment } from './linkedInPublishMediaUtils';

export interface ResolvedPublishMedia {
  source: LinkedInPublishMediaSource | 'none';
  imageId?: string;
  localFile?: File;
}

export function resolvePublishMedia(
  attachment: LinkedInPublishMediaAttachment | null,
): ResolvedPublishMedia {
  if (!attachment) {
    return { source: 'none' };
  }

  if (attachment.source === 'ai') {
    return { source: 'ai', imageId: attachment.imageId };
  }

  return { source: 'upload', localFile: attachment.localFile };
}

export async function publishLinkedInWithMedia(options: {
  content: string;
  accountId?: string;
  draft?: string;
  attachment: LinkedInPublishMediaAttachment | null;
}): Promise<LinkedInPublishPostResponse> {
  const { content, accountId, draft = '', attachment } = options;
  const resolvedAttachment = resolvePublishMediaAttachment(draft, attachment);
  const media = resolvePublishMedia(resolvedAttachment);
  const payload = {
    content,
    account_id: accountId,
  };

  if (media.source === 'upload' && media.localFile) {
    return publishLinkedInPostWithFile(payload, media.localFile);
  }

  if (media.source === 'ai' && media.imageId) {
    return publishLinkedInPost({
      ...payload,
      image_ids: [media.imageId],
    });
  }

  return publishLinkedInPost(payload);
}

export function buildLinkedInPublishSuccessMessage(
  result: LinkedInPublishPostResponse,
): string {
  if (result.has_media) {
    return result.message || 'Published to LinkedIn with image.';
  }
  return result.message || 'Published to LinkedIn.';
}

export function getLinkedInPublishButtonLabel(
  hasAttachment: boolean,
  isPublishing: boolean,
): string {
  if (isPublishing) {
    return hasAttachment ? 'Publishing text + image…' : 'Publishing…';
  }
  return hasAttachment ? 'Publish text + image' : 'Publish';
}

export function getLinkedInPublishConfirmLabel(hasAttachment: boolean): string {
  return hasAttachment ? '🚀 Confirm & Publish (text + image)' : '🚀 Confirm & Publish';
}
