/**
 * LinkedIn feed preview truncation helpers.
 * Approximates mobile/desktop "see more" cutoffs in the feed (not the 1,300 soft publish limit).
 */

export type LinkedInFeedDevice = "desktop" | "mobile";

/** Feed fold approximations — aligned with analytics PostCard preview (280 desktop-ish). */
export const LINKEDIN_FEED_SEE_MORE_CHARS: Record<LinkedInFeedDevice, number> = {
  mobile: 210,
  desktop: 280,
};

export interface FeedTextPreview {
  collapsedText: string;
  isTruncated: boolean;
}

/**
 * Collapse post body for feed preview unless expanded.
 * Preserves intentional line breaks in the returned strings.
 */
export function getFeedCollapsedText(
  plainText: string,
  device: LinkedInFeedDevice,
  expanded: boolean,
): FeedTextPreview {
  const text = (plainText || "").trim();
  if (!text || expanded) {
    return { collapsedText: text, isTruncated: false };
  }

  const limit = LINKEDIN_FEED_SEE_MORE_CHARS[device];
  if (text.length <= limit) {
    return { collapsedText: text, isTruncated: false };
  }

  let cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > limit * 0.65) {
    cut = cut.slice(0, lastSpace);
  }

  return {
    collapsedText: cut.trimEnd(),
    isTruncated: true,
  };
}

/** Frame width tokens for device mockups. */
export function getFeedFrameWidth(device: LinkedInFeedDevice): number {
  return device === "mobile" ? 390 : 552;
}
