/**
 * Build assistive editor snapshot from draft markdown — preserves author spacing.
 * Auto line-break normalization runs at generation time only (linkedInPostAssembly).
 */

import {
  splitDraftForAssistiveEditor,
  type LinkedInEditorImageBlock,
} from "./linkedInEditorDraftUtils";

const LOG_PREFIX = "[LinkedInAssistiveEditorSnapshot]";

export type AssistiveEditorSnapshot = {
  text: string;
  images: LinkedInEditorImageBlock[];
};

/** Parse draft into editor snapshot without rewriting line breaks. */
export function buildAssistiveEditorSnapshotFromDraft(
  draft: string,
): AssistiveEditorSnapshot {
  try {
    const parsed = splitDraftForAssistiveEditor(draft || "");
    const text = (parsed.textContent || "").replace(/\r\n/g, "\n");
    console.debug(`${LOG_PREFIX} built snapshot`, {
      draftLength: draft.length,
      textLength: text.length,
      imageCount: parsed.images.length,
    });
    return { text, images: parsed.images };
  } catch (error) {
    console.error(`${LOG_PREFIX} failed to build snapshot`, {
      draftLength: draft?.length ?? 0,
      error: error instanceof Error ? error.message : String(error),
    });
    return { text: "", images: [] };
  }
}
