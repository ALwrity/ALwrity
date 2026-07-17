/**
 * Utilities for inserting and parsing LinkedIn-generated images in post drafts.
 */

const LINKEDIN_IMAGE_URL_PATTERN = /\/api\/linkedin\/images\/([^/?#]+)/;

/** Build markdown image syntax for a generated LinkedIn image. */
export function buildLinkedInImageMarkdown(
  imageUrl: string,
  alt = 'Generated LinkedIn image',
): string {
  return `![${alt}](${imageUrl})`;
}

/** Append a generated image markdown block to the end of a draft. */
export function appendImageMarkdownToDraft(
  draft: string,
  imageUrl: string,
  alt?: string,
): string {
  const markdown = buildLinkedInImageMarkdown(imageUrl, alt);
  if (!draft.trim()) {
    return `${markdown}\n`;
  }

  const separator = draft.endsWith('\n\n') ? '' : draft.endsWith('\n') ? '\n' : '\n\n';
  return `${draft}${separator}${markdown}\n`;
}

/** Extract a LinkedIn image ID from a stored image URL, if present. */
export function extractLinkedInImageId(imageUrl: string): string | null {
  const match = imageUrl.match(LINKEDIN_IMAGE_URL_PATTERN);
  return match?.[1] ?? null;
}

export const LINKEDIN_IMAGE_MARKDOWN_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

export interface LinkedInDraftImageSegment {
  type: 'image';
  alt: string;
  url: string;
  imageId: string | null;
}

export interface LinkedInDraftTextSegment {
  type: 'text';
  content: string;
}

export type LinkedInDraftSegment = LinkedInDraftImageSegment | LinkedInDraftTextSegment;

/** Split draft content into text and image markdown segments for preview rendering. */
export function splitDraftByImageMarkdown(draft: string): LinkedInDraftSegment[] {
  if (!draft) return [];

  const segments: LinkedInDraftSegment[] = [];
  const regex = new RegExp(LINKEDIN_IMAGE_MARKDOWN_REGEX.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null = regex.exec(draft);

  while (match) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: draft.slice(lastIndex, match.index),
      });
    }

    const url = match[2].trim();
    segments.push({
      type: 'image',
      alt: match[1].trim() || 'Generated LinkedIn image',
      url,
      imageId: extractLinkedInImageId(url),
    });

    lastIndex = regex.lastIndex;
    match = regex.exec(draft);
  }

  if (lastIndex < draft.length) {
    segments.push({
      type: 'text',
      content: draft.slice(lastIndex),
    });
  }

  return segments;
}
