const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/i;

export const LINK_IN_FIRST_COMMENT_SUFFIX = 'Link in first comment 👇';

export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

export function removeFirstUrl(text: string, url: string): string {
  return text.replace(url, '').replace(/\s{2,}/g, ' ').trim();
}

export interface ApplyLinkInFirstCommentResult {
  content: string;
  firstComment: string;
  changed: boolean;
}

/**
 * When draft contains a URL and firstComment is empty, move the URL to firstComment
 * and append a short cue line to the post body.
 */
export function applyLinkInFirstComment(
  draft: string,
  firstComment: string,
  enabled = true
): ApplyLinkInFirstCommentResult {
  if (!enabled || firstComment.trim()) {
    return { content: draft, firstComment, changed: false };
  }

  const url = extractFirstUrl(draft);
  if (!url) {
    return { content: draft, firstComment, changed: false };
  }

  let content = removeFirstUrl(draft, url);
  if (!content.includes(LINK_IN_FIRST_COMMENT_SUFFIX)) {
    content = content ? `${content}\n\n${LINK_IN_FIRST_COMMENT_SUFFIX}` : LINK_IN_FIRST_COMMENT_SUFFIX;
  }

  return {
    content,
    firstComment: url,
    changed: true,
  };
}

export function buildPublishPayload(
  draft: string,
  firstComment: string,
  moveLinksEnabled: boolean
): { content: string; first_comment: string } {
  const applied = applyLinkInFirstComment(draft, firstComment, moveLinksEnabled);
  return {
    content: applied.content,
    first_comment: applied.firstComment,
  };
}
