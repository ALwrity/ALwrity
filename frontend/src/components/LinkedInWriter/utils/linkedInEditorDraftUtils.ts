/**
 * Split and merge LinkedIn assistive editor draft: text in textarea, images as visual blocks.
 */

import {
  buildLinkedInImageMarkdown,
  splitDraftByImageMarkdown,
} from './linkedInImageDraftUtils';

export interface LinkedInEditorImageBlock {
  id: string;
  alt: string;
  url: string;
  imageId: string | null;
  markdown: string;
}

export interface LinkedInAssistiveEditorDraft {
  textContent: string;
  images: LinkedInEditorImageBlock[];
}

function blockIdFromUrl(url: string, index: number): string {
  const imageIdMatch = url.match(/\/api\/linkedin\/images\/([^/?#]+)/);
  return imageIdMatch?.[1] ?? `img-${index}-${url.slice(-12)}`;
}

/** Separate post text from image markdown for LinkedIn-style editor display. */
export function splitDraftForAssistiveEditor(draft: string): LinkedInAssistiveEditorDraft {
  const segments = splitDraftByImageMarkdown(draft);
  const images: LinkedInEditorImageBlock[] = [];
  const textParts: string[] = [];

  segments.forEach((segment, index) => {
    if (segment.type === 'image') {
      images.push({
        id: blockIdFromUrl(segment.url, index),
        alt: segment.alt,
        url: segment.url,
        imageId: segment.imageId,
        markdown: buildLinkedInImageMarkdown(segment.url, segment.alt),
      });
      return;
    }

    if (segment.content.trim()) {
      textParts.push(segment.content.replace(/\s+$/, ''));
    }
  });

  return {
    textContent: textParts.join('\n\n'),
    images,
  };
}

/** Merge textarea text and image blocks back into persisted draft markdown. */
export function mergeAssistiveEditorDraft(
  textContent: string,
  images: LinkedInEditorImageBlock[],
): string {
  const text = textContent.replace(/\n{3,}/g, '\n\n').trimEnd();
  if (images.length === 0) {
    return text;
  }

  const imageMarkdown = images.map((image) => image.markdown).join('\n\n');
  if (!text) {
    return `${imageMarkdown}\n`;
  }

  return `${text}\n\n${imageMarkdown}\n`;
}

/** Create an image block after a successful upload or AI generation. */
export function createEditorImageBlock(
  imageUrl: string,
  imageId: string,
  alt = 'Post image',
): LinkedInEditorImageBlock {
  return {
    id: imageId,
    alt,
    url: imageUrl,
    imageId,
    markdown: buildLinkedInImageMarkdown(imageUrl, alt),
  };
}
