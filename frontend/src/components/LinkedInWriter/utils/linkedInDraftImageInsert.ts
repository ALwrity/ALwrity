/**
 * Insert a generated/uploaded LinkedIn image into the assistive editor draft.
 */

import { appendImageMarkdownToDraft } from './linkedInImageDraftUtils';

export interface InsertImageIntoLinkedInDraftOptions {
  /** Flush pending assistive editor edits before inserting (e.g. assistiveEditorRef.flushDraft). */
  flushDraft?: () => string | undefined;
  alt?: string;
}

/**
 * Append image markdown to the current draft, optionally flushing assistive editor state first.
 */
export function insertImageIntoLinkedInDraft(
  draft: string,
  imageUrl: string,
  options?: InsertImageIntoLinkedInDraftOptions,
): string {
  const trimmedUrl = imageUrl?.trim();
  if (!trimmedUrl) {
    console.error('[LinkedInDraftImageInsert] insert skipped: empty imageUrl');
    throw new Error('Image URL is required to insert into draft');
  }

  try {
    const flushed = options?.flushDraft?.();
    const baseDraft = typeof flushed === 'string' ? flushed : draft;
    const newDraft = appendImageMarkdownToDraft(
      baseDraft,
      trimmedUrl,
      options?.alt,
    );

    console.debug('[LinkedInDraftImageInsert] image appended to draft', {
      baseLength: baseDraft.length,
      newLength: newDraft.length,
      usedFlush: typeof flushed === 'string',
    });

    return newDraft;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[LinkedInDraftImageInsert] insert failed', { error: message });
    throw error;
  }
}
