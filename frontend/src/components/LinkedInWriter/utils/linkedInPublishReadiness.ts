/**
 * Pure helpers for LinkedIn publish readiness (limits, checklist).
 * UI components should call these — do not duplicate limit logic.
 */

import { formatDraftForPublish } from './linkedInPublishFormatters';
import {
  LINKEDIN_HASHTAG_SOFT_MAX,
  LINKEDIN_POST_HARD_LIMIT,
  LINKEDIN_POST_SEE_MORE_SOFT,
  LINKEDIN_PUBLISH_EMPTY_ERROR,
  LINKEDIN_PUBLISH_TOO_LONG_ERROR,
} from './linkedInPostFormatConstants';

export interface CharReadiness {
  count: number;
  isEmpty: boolean;
  hardOk: boolean;
  seeMoreSoftOk: boolean;
}

export interface HashtagReadiness {
  count: number;
  softOk: boolean;
}

export type PublishChecklistSeverity = 'hard' | 'soft' | 'info';

export interface PublishChecklistItem {
  id: string;
  label: string;
  detail: string;
  ok: boolean | null;
  severity: PublishChecklistSeverity;
}

export interface HardPublishLimitResult {
  ok: boolean;
  error?: string;
}

const CTA_PATTERN =
  /\?|call to action|comment below|what do you think|share your|let me know|drop a|tell me|agree\?/i;

/** Canonical plain text that will be sent to LinkedIn. */
export function getPublishPlainText(draft: string): string {
  return formatDraftForPublish(draft || '');
}

export function getCharReadiness(plainText: string): CharReadiness {
  const count = (plainText || '').length;
  const isEmpty = count === 0 || !(plainText || '').trim();
  return {
    count,
    isEmpty,
    hardOk: !isEmpty && count <= LINKEDIN_POST_HARD_LIMIT,
    seeMoreSoftOk: count <= LINKEDIN_POST_SEE_MORE_SOFT,
  };
}

export function getHashtagReadiness(plainText: string): HashtagReadiness {
  const matches = (plainText || '').match(/#\w+/g);
  const count = matches ? matches.length : 0;
  return {
    count,
    softOk: count <= LINKEDIN_HASHTAG_SOFT_MAX,
  };
}

function hasHookInFirstLines(plainText: string): boolean {
  const lines = (plainText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return false;
  // Hook: first line has substance (not only emoji/hashtag)
  const first = lines[0];
  const withoutTags = first.replace(/[#@]\w+/g, '').replace(/[^\w\s.,!?'"-]/g, '').trim();
  return withoutTags.length >= 12;
}

function hasCtaSignal(plainText: string): boolean {
  return CTA_PATTERN.test(plainText || '');
}

/** Soft + hard checklist for publish UX (hard items must pass to enable Confirm). */
export function getPublishChecklist(
  draft: string,
  hasMedia: boolean,
): PublishChecklistItem[] {
  const plain = getPublishPlainText(draft);
  const chars = getCharReadiness(plain);
  const tags = getHashtagReadiness(plain);

  return [
    {
      id: 'not_empty',
      label: 'Post content',
      detail: chars.isEmpty ? 'Add text before publishing.' : 'Content ready.',
      ok: !chars.isEmpty,
      severity: 'hard',
    },
    {
      id: 'hard_limit',
      label: 'LinkedIn character limit',
      detail: chars.isEmpty
        ? `0 / ${LINKEDIN_POST_HARD_LIMIT}`
        : chars.hardOk
          ? `${chars.count} / ${LINKEDIN_POST_HARD_LIMIT} characters`
          : `${chars.count} / ${LINKEDIN_POST_HARD_LIMIT} — exceeds LinkedIn limit`,
      ok: chars.hardOk,
      severity: 'hard',
    },
    {
      id: 'see_more',
      label: 'Stay under 1,300 characters',
      detail: chars.seeMoreSoftOk
        ? `Under ~${LINKEDIN_POST_SEE_MORE_SOFT} characters — full post visible in feed.`
        : `Posts over ${LINKEDIN_POST_SEE_MORE_SOFT} chars are truncated with a “see more” break. Still publishable.`,
      ok: chars.isEmpty ? null : chars.seeMoreSoftOk ? true : null,
      severity: 'soft',
    },
    {
      id: 'hook',
      label: 'Start with a strong hook',
      detail: hasHookInFirstLines(plain)
        ? 'First line looks strong enough to earn a “see more” click.'
        : 'The first line determines if readers click “see more”. Use a surprising claim, question, or outcome.',
      ok: chars.isEmpty ? null : hasHookInFirstLines(plain) ? true : null,
      severity: 'soft',
    },
    {
      id: 'cta',
      label: 'End with a clear CTA',
      detail: hasCtaSignal(plain)
        ? 'Includes a question or clear ask.'
        : 'Ask a specific question or invite a reaction. Posts that drive comments get more reach.',
      ok: chars.isEmpty ? null : hasCtaSignal(plain) ? true : null,
      severity: 'soft',
    },
    {
      id: 'hashtags',
      label: 'Use 3–5 hashtags maximum',
      detail:
        tags.count === 0
          ? 'Optional — place 3–5 relevant hashtags at the end, never inline.'
          : tags.softOk
            ? `${tags.count} hashtag${tags.count === 1 ? '' : 's'} (within the usual 3–5).`
            : `${tags.count} hashtags — more than ${LINKEDIN_HASHTAG_SOFT_MAX} can look spammy.`,
      ok: tags.count === 0 ? null : tags.softOk ? true : null,
      severity: 'soft',
    },
    {
      id: 'image',
      label: 'Post image',
      detail: hasMedia
        ? 'Image will publish with your post.'
        : 'Optional — posts with an image often get more engagement.',
      ok: hasMedia ? true : null,
      severity: 'info',
    },
  ];
}

/** True when all hard checklist items pass for the given draft/plain text. */
export function areHardPublishChecksOk(draftOrPlain: string): boolean {
  return getPublishChecklist(draftOrPlain, false)
    .filter((item) => item.severity === 'hard')
    .every((item) => item.ok === true);
}

/** Hard gate only: empty content or over LinkedIn’s 3000-character limit. */
export function assertHardPublishLimits(plainText: string): HardPublishLimitResult {
  const chars = getCharReadiness(plainText);
  if (chars.isEmpty) {
    return { ok: false, error: LINKEDIN_PUBLISH_EMPTY_ERROR };
  }
  if (chars.count > LINKEDIN_POST_HARD_LIMIT) {
    return { ok: false, error: LINKEDIN_PUBLISH_TOO_LONG_ERROR };
  }
  return { ok: true };
}

export function formatCharCountLabel(count: number): string {
  return `${count} / ${LINKEDIN_POST_HARD_LIMIT}`;
}

export function getSeeMoreCaption(chars: CharReadiness): string | null {
  if (chars.isEmpty) return null;
  if (chars.seeMoreSoftOk) return null;
  return `Past see more (~${LINKEDIN_POST_SEE_MORE_SOFT.toLocaleString()} characters) — still publishable.`;
}
