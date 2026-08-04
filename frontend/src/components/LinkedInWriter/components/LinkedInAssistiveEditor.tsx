import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from "react";
import { Alert, Box } from "@mui/material";
import {
  applyMarkdownFormat,
  type MarkdownFormatType,
} from "../../TextEditor/markdownFormatting";
import { useUndoRedo } from "../../../hooks/useUndoRedo";
import { LinkedInEditorToolbar } from "./LinkedInEditorToolbar";
import { LinkedInEditorImageStrip } from "./LinkedInEditorImageStrip";
import { LinkedInAssistiveHighlightField } from "./LinkedInAssistiveHighlightField";
import { useLinkedInEditorImageUpload } from "../hooks/useLinkedInEditorImageUpload";
import {
  mergeAssistiveEditorDraft,
  splitDraftForAssistiveEditor,
  type LinkedInEditorImageBlock,
} from "../utils/linkedInEditorDraftUtils";
import { LINKEDIN_PUBLISH_ACCEPTED_IMAGE_EXTENSIONS } from "../utils/linkedInPublishMediaConstants";
import {
  needsLinkedInPostSpacingNormalization,
  normalizeLinkedInPostSpacing,
} from "../utils/linkedInPostSpacing";
import type { AssistiveTextHighlightRange } from "../utils/linkedInAssistiveHighlightUtils";

const LOG_PREFIX = "[LinkedInAssistiveEditor]";

export interface LinkedInAssistiveEditorHandle {
  /** Flush pending edits and return the merged draft markdown. */
  flushDraft: () => string;
}

/** Snapshot stored in undo/redo history (text + attached images). */
type AssistiveEditorSnapshot = {
  text: string;
  images: LinkedInEditorImageBlock[];
};

/** Normalize dense AI text once on load; never rewrite user line breaks afterward. */
function normalizeAssistiveTextOnLoad(text: string): string {
  const raw = (text || "").replace(/\r\n/g, "\n");
  if (!needsLinkedInPostSpacingNormalization(raw)) return raw;
  return normalizeLinkedInPostSpacing(raw);
}

function buildInitialSnapshot(draft: string): AssistiveEditorSnapshot {
  const parsed = splitDraftForAssistiveEditor(draft);
  return {
    text: normalizeAssistiveTextOnLoad(parsed.textContent),
    images: parsed.images,
  };
}

interface LinkedInAssistiveEditorProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onTypingChange?: (text: string, caretIndex?: number) => void;
  onTextareaSelection?: (textarea: HTMLTextAreaElement) => void;
  highlightRange?: AssistiveTextHighlightRange | null;
  onHighlightClear?: () => void;
}

/**
 * LinkedIn-native-style assistive editor: clean text area + inline photo strip + toolbar upload.
 * Undo/Redo reuses Story Writer's useUndoRedo (keyboard shortcuts off to protect native textarea).
 */
export const LinkedInAssistiveEditor = forwardRef<
  LinkedInAssistiveEditorHandle,
  LinkedInAssistiveEditorProps
>(function LinkedInAssistiveEditor(
  { draft, onDraftChange, onTypingChange, onTextareaSelection, highlightRange, onHighlightClear },
  ref,
) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastEmittedDraftRef = useRef<string>(draft);
  const [isDragOver, setIsDragOver] = useState(false);

  const {
    value: snapshot,
    setValue: setSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory,
  } = useUndoRedo<AssistiveEditorSnapshot>(buildInitialSnapshot(draft), {
    limit: 30,
    enableKeyboardShortcuts: false,
  });

  const textContent = snapshot.text;
  const images = snapshot.images;

  const { isUploading, uploadError, uploadImageFile, clearUploadError } =
    useLinkedInEditorImageUpload();

  const emitDraft = useCallback(
    (
      nextText: string,
      nextImages: LinkedInEditorImageBlock[],
      immediate = false,
    ) => {
      const merged = mergeAssistiveEditorDraft(nextText, nextImages);

      const commit = () => {
        lastEmittedDraftRef.current = merged;
        onDraftChange(merged);
      };

      if (immediate) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        commit();
        return;
      }

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(commit, 600);
    },
    [onDraftChange],
  );

  const commitSnapshot = useCallback(
    (next: AssistiveEditorSnapshot, immediate = false) => {
      setSnapshot(next);
      emitDraft(next.text, next.images, immediate);
    },
    [setSnapshot, emitDraft],
  );

  useImperativeHandle(
    ref,
    () => ({
      flushDraft: () => {
        const merged = mergeAssistiveEditorDraft(textContent, images);
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        if (merged !== lastEmittedDraftRef.current) {
          lastEmittedDraftRef.current = merged;
          onDraftChange(merged);
        }
        return merged;
      },
    }),
    [textContent, images, onDraftChange],
  );

  useLayoutEffect(() => {
    if (draft === lastEmittedDraftRef.current) return;

    // Cancel pending debounce so a stale text-only emit cannot wipe a newly
    // inserted image (or other external draft updates) after Done/generate.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const parsed = splitDraftForAssistiveEditor(draft);
    const raw = parsed.textContent.replace(/\r\n/g, "\n");
    const nextText = needsLinkedInPostSpacingNormalization(raw)
      ? normalizeLinkedInPostSpacing(raw)
      : raw;
    const next: AssistiveEditorSnapshot = {
      text: nextText,
      images: parsed.images,
    };
    resetHistory(next);
    console.log(`${LOG_PREFIX} history reset from external draft`, {
      textLength: nextText.length,
      imageCount: parsed.images.length,
      autoSpaced: nextText !== raw,
    });

    if (nextText !== raw) {
      emitDraft(nextText, parsed.images, true);
    } else {
      lastEmittedDraftRef.current = draft;
    }
  }, [draft, emitDraft, resetHistory]);

  // One-shot: persist initial auto-spacing for dense AI drafts to parent state.
  useEffect(() => {
    const parsed = splitDraftForAssistiveEditor(draft);
    const raw = parsed.textContent.replace(/\r\n/g, "\n");
    const normalized = normalizeAssistiveTextOnLoad(raw);
    if (normalized !== raw) {
      emitDraft(normalized, parsed.images, true);
      console.log(`${LOG_PREFIX} initial dense draft spacing normalized`, {
        rawLength: raw.length,
        normalizedLength: normalized.length,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only sync
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [textContent, images.length]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleFormat = useCallback(
    (type: MarkdownFormatType) => {
      const textarea = textareaRef.current;
      const result = applyMarkdownFormat(textarea, textContent, type);
      if (!result) return;

      const { newValue, cursorPos } = result;
      commitSnapshot({ text: newValue, images }, true);

      requestAnimationFrame(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(cursorPos, cursorPos);
        }
      });
    },
    [textContent, images, commitSnapshot],
  );

  const handleInsertEmoji = useCallback(
    (emoji: string) => {
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart ?? textContent.length;
      const end = textarea?.selectionEnd ?? textContent.length;
      const nextText =
        textContent.slice(0, start) + emoji + textContent.slice(end);

      commitSnapshot({ text: nextText, images }, true);
      console.log(`${LOG_PREFIX} emoji inserted`, {
        at: start,
        textLength: nextText.length,
      });

      requestAnimationFrame(() => {
        if (!textarea) return;
        textarea.focus();
        const pos = start + emoji.length;
        textarea.setSelectionRange(pos, pos);
      });
    },
    [textContent, images, commitSnapshot],
  );

  const handleUndo = useCallback(() => {
    const restored = undo();
    if (!restored) return;
    emitDraft(restored.text, restored.images, true);
    onTypingChange?.(restored.text, restored.text.length);
    console.log(`${LOG_PREFIX} undo`, {
      textLength: restored.text.length,
      imageCount: restored.images.length,
    });
  }, [undo, emitDraft, onTypingChange]);

  const handleRedo = useCallback(() => {
    const restored = redo();
    if (!restored) return;
    emitDraft(restored.text, restored.images, true);
    onTypingChange?.(restored.text, restored.text.length);
    console.log(`${LOG_PREFIX} redo`, {
      textLength: restored.text.length,
      imageCount: restored.images.length,
    });
  }, [redo, emitDraft, onTypingChange]);

  const appendImage = useCallback(
    (block: LinkedInEditorImageBlock) => {
      const nextImages = [...images, block];
      commitSnapshot({ text: textContent, images: nextImages }, true);
      console.log(`${LOG_PREFIX} image appended`, {
        imageId: block.id,
        imageCount: nextImages.length,
      });
    },
    [textContent, images, commitSnapshot],
  );

  const handleUploadFile = useCallback(
    async (file: File) => {
      clearUploadError();
      try {
        const block = await uploadImageFile(file);
        if (block) {
          appendImage(block);
        }
      } catch (err) {
        console.error(`${LOG_PREFIX} image upload failed`, err);
      }
    },
    [appendImage, clearUploadError, uploadImageFile],
  );

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleUploadFile(file);
      }
      event.target.value = "";
    },
    [handleUploadFile],
  );

  const handleRemoveImage = useCallback(
    (imageId: string) => {
      const nextImages = images.filter((image) => image.id !== imageId);
      commitSnapshot({ text: textContent, images: nextImages }, true);
      console.log(`${LOG_PREFIX} image removed`, {
        imageId,
        imageCount: nextImages.length,
      });
    },
    [textContent, images, commitSnapshot],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);
      const file = event.dataTransfer.files?.[0];
      if (file) {
        handleUploadFile(file);
      }
    },
    [handleUploadFile],
  );

  const handleTextareaSelectionEvent = useCallback(() => {
    if (textareaRef.current) {
      onTextareaSelection?.(textareaRef.current);
    }
  }, [onTextareaSelection]);

  return (
    <Box
      onDrop={handleDrop}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      sx={{
        borderRadius: 2,
        outline: isDragOver ? "2px dashed #0A66C2" : "none",
        outlineOffset: 2,
        transition: "outline-color 0.15s ease",
      }}
    >
      <LinkedInEditorToolbar
        onFormat={handleFormat}
        onUploadImage={() => fileInputRef.current?.click()}
        onInsertEmoji={handleInsertEmoji}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        isUploading={isUploading}
      />

      {/* Keep photo actions under the toolbar so Download/Delete stay visible. */}
      <Box
        sx={{
          borderLeft: "1px solid #e2e8f0",
          borderRight: "1px solid #e2e8f0",
          bgcolor: "#fff",
          px: 1.25,
        }}
      >
        <LinkedInEditorImageStrip images={images} onRemove={handleRemoveImage} />
      </Box>

      <LinkedInAssistiveHighlightField
        value={textContent}
        highlightRange={highlightRange ?? null}
        onHighlightClear={onHighlightClear}
        textareaRef={textareaRef}
        borderTop={images.length > 0 ? "1px solid #e2e8f0" : "none"}
        onChange={(event) => {
          const value = event.target.value;
          commitSnapshot({ text: value, images }, false);

          const caretIndex = event.target.selectionStart ?? value.length;
          onTypingChange?.(value, caretIndex);
        }}
        onMouseUp={handleTextareaSelectionEvent}
        onKeyUp={handleTextareaSelectionEvent}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={LINKEDIN_PUBLISH_ACCEPTED_IMAGE_EXTENSIONS}
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />

      {(uploadError || isDragOver) && (
        <Box sx={{ mt: 1 }}>
          {uploadError && (
            <Alert severity="error" sx={{ py: 0 }}>
              {uploadError}
            </Alert>
          )}
          {isDragOver && !uploadError && (
            <Alert severity="info" sx={{ py: 0 }}>
              Drop image to add to your post
            </Alert>
          )}
        </Box>
      )}
    </Box>
  );
});

LinkedInAssistiveEditor.displayName = "LinkedInAssistiveEditor";
