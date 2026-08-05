/**
 * Shared LinkedIn post length / hashtag limits for publish UX.
 * Soft limits warn; hard limit blocks publish.
 */

/** LinkedIn platform hard character limit — block publish when exceeded. */
export const LINKEDIN_POST_HARD_LIMIT = 3000;

/**
 * Soft “see more” cutoff. Posts longer than this are often truncated in feed.
 * Warning only — does not block publish.
 */
export const LINKEDIN_POST_SEE_MORE_SOFT = 1300;

/** Soft max recommended hashtags — warning only. */
export const LINKEDIN_HASHTAG_SOFT_MAX = 5;

export const LINKEDIN_PUBLISH_EMPTY_ERROR = "Post content cannot be empty.";

export const LINKEDIN_PUBLISH_TOO_LONG_ERROR =
  "Post is too long for LinkedIn (max 3,000 characters).";

export const LINKEDIN_PUBLISH_PLAIN_NOTE =
  "Bold and headings won’t appear on LinkedIn. This is what will post.";

/** LinkedIn article soft word-count band (Knowledge Center guidance). */
export const LINKEDIN_ARTICLE_SOFT_MIN = 1500;

export const LINKEDIN_ARTICLE_SOFT_MAX = 3000;

/** Default generation target when prefs have no word_count. */
export const DEFAULT_ARTICLE_WORD_TARGET = 1500;

export const LINKEDIN_ARTICLE_PUBLISH_DISABLED_TOOLTIP =
  "Article publishing is not available via Unipile v1 — finish in LinkedIn's native article editor, or copy your draft and paste it there.";
