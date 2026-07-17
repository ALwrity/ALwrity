/**
 * Assemble LinkedIn post body + optional CTA + hashtags without doubling blocks.
 *
 * Order: body → CTA (if needed) → hashtags (if needed).
 * Hashtags belong at the end only (Best Practices).
 */

import { getHashtagReadiness } from './linkedInPublishReadiness';
import { normalizeLinkedInPostSpacing } from './linkedInPostSpacing';

const CTA_PATTERN =
  /\?|call to action|comment below|what do you think|share your|let me know|drop a|tell me|agree\?/i;

export const DEFAULT_LINKEDIN_POST_MAX_LENGTH = 1500;

export interface AssembleLinkedInPostOptions {
  content: string;
  /** Space-joined hashtags, e.g. "#ai #leadership" */
  hashtags?: string;
  callToAction?: string;
  includeHashtags?: boolean;
  includeCallToAction?: boolean;
}

function bodyAlreadyHasCta(body: string): boolean {
  const trimmed = (body || '').trim();
  if (!trimmed) return false;
  const lastChunk = trimmed.split(/\n+/).filter(Boolean).slice(-2).join(' ');
  return CTA_PATTERN.test(lastChunk) || /\?\s*$/.test(trimmed);
}

/**
 * Merge LLM content with optional CTA and hashtag fields.
 * Skips CTA/hashtag append when the body already includes them.
 * Applies Best Practices spacing (paragraph gaps, bullets on own lines).
 */
export function assembleLinkedInPostContent(options: AssembleLinkedInPostOptions): string {
  const body = (options.content || '').trim();
  if (!body) return '';

  let result = body;

  const wantCta = options.includeCallToAction !== false;
  const cta = (options.callToAction || '').trim();
  if (wantCta && cta && !bodyAlreadyHasCta(result)) {
    result = `${result}\n\n${cta}`;
  }

  const wantTags = options.includeHashtags !== false;
  const tags = (options.hashtags || '').trim();
  const existingTagCount = getHashtagReadiness(result).count;
  // Skip when body already has hashtags (LLM often includes them) to avoid doubles.
  if (wantTags && tags && existingTagCount === 0) {
    result = `${result}\n\n${tags}`;
  }

  return normalizeLinkedInPostSpacing(result);
}

/** Normalize hashtag list from API into a single space-joined string. */
export function joinHashtagSuggestions(
  hashtags: Array<string | { hashtag?: string }> | undefined | null,
): string {
  if (!hashtags?.length) return '';
  return hashtags
    .map((item) => {
      if (typeof item === 'string') {
        return item.startsWith('#') ? item : `#${item}`;
      }
      const tag = item.hashtag || '';
      if (!tag) return '';
      return tag.startsWith('#') ? tag : `#${tag}`;
    })
    .filter(Boolean)
    .join(' ');
}
