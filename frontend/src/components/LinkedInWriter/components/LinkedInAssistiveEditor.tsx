import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Alert, Box } from '@mui/material';
import { applyMarkdownFormat, type MarkdownFormatType } from '../../TextEditor/markdownFormatting';
import { LinkedInEditorToolbar } from './LinkedInEditorToolbar';
import { LinkedInEditorImageStrip } from './LinkedInEditorImageStrip';
import { useLinkedInEditorImageUpload } from '../hooks/useLinkedInEditorImageUpload';
import {
  mergeAssistiveEditorDraft,
  splitDraftForAssistiveEditor,
  type LinkedInEditorImageBlock,
} from '../utils/linkedInEditorDraftUtils';
import { LINKEDIN_PUBLISH_ACCEPTED_IMAGE_EXTENSIONS } from '../utils/linkedInPublishMediaConstants';
import { normalizeLinkedInPostSpacing } from '../utils/linkedInPostSpacing';

export interface LinkedInAssistiveEditorHandle {
  /** Flush pending edits and return the merged draft markdown. */
  flushDraft: () => string;
}

/** Always apply Best Practices spacing (idempotent for already-spaced posts). */
function maybeNormalizeAssistiveText(text: string): string {
  return normalizeLinkedInPostSpacing(text);
}

interface LinkedInAssistiveEditorProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onTypingChange?: (text: string, caretIndex?: number) => void;
  onTextareaSelection?: (textarea: HTMLTextAreaElement) => void;
}

/**
 * LinkedIn-native-style assistive editor: clean text area + inline photo strip + toolbar upload.
 */
export const LinkedInAssistiveEditor = forwardRef<
  LinkedInAssistiveEditorHandle,
  LinkedInAssistiveEditorProps
>(function LinkedInAssistiveEditor(
  {
  draft,
  onDraftChange,
  onTypingChange,
  onTextareaSelection,
  },
  ref,
) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastEmittedDraftRef = useRef<string>(draft);

  const initial = splitDraftForAssistiveEditor(draft);
  const [textContent, setTextContent] = useState(() =>
    maybeNormalizeAssistiveText(initial.textContent),
  );
  const [images, setImages] = useState<LinkedInEditorImageBlock[]>(initial.images);
  const [isDragOver, setIsDragOver] = useState(false);

  const { isUploading, uploadError, uploadImageFile, clearUploadError } =
    useLinkedInEditorImageUpload();

  const emitDraft = useCallback(
    (nextText: string, nextImages: LinkedInEditorImageBlock[], immediate = false) => {
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

  useEffect(() => {
    if (draft === lastEmittedDraftRef.current) return;

    const parsed = splitDraftForAssistiveEditor(draft);
    const nextText = maybeNormalizeAssistiveText(parsed.textContent);
    setTextContent(nextText);
    setImages(parsed.images);

    if (nextText !== parsed.textContent) {
      // Persist Best Practices spacing back into the draft once for dense posts.
      emitDraft(nextText, parsed.images, true);
    } else {
      lastEmittedDraftRef.current = draft;
    }
  }, [draft, emitDraft]);

  // On first mount, persist auto-spacing if the initial draft was dense.
  useEffect(() => {
    const parsed = splitDraftForAssistiveEditor(draft);
    const nextText = maybeNormalizeAssistiveText(parsed.textContent);
    if (nextText !== parsed.textContent) {
      emitDraft(nextText, parsed.images, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot mount sync
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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
      setTextContent(newValue);
      emitDraft(newValue, images, true);

      requestAnimationFrame(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(cursorPos, cursorPos);
        }
      });
    },
    [textContent, images, emitDraft],
  );

  const appendImage = useCallback(
    (block: LinkedInEditorImageBlock) => {
      setImages((prev) => {
        const next = [...prev, block];
        emitDraft(textContent, next, true);
        return next;
      });
    },
    [textContent, emitDraft],
  );

  const handleUploadFile = useCallback(
    async (file: File) => {
      clearUploadError();
      const block = await uploadImageFile(file);
      if (block) {
        appendImage(block);
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
      event.target.value = '';
    },
    [handleUploadFile],
  );

  const handleRemoveImage = useCallback(
    (imageId: string) => {
      setImages((prev) => {
        const next = prev.filter((image) => image.id !== imageId);
        emitDraft(textContent, next, true);
        return next;
      });
    },
    [textContent, emitDraft],
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
        outline: isDragOver ? '2px dashed #0A66C2' : 'none',
        outlineOffset: 2,
        transition: 'outline-color 0.15s ease',
      }}
    >
      <LinkedInEditorToolbar
        onFormat={handleFormat}
        onUploadImage={() => fileInputRef.current?.click()}
        isUploading={isUploading}
      />

      <textarea
        ref={textareaRef}
        value={textContent}
        onChange={(event) => {
          const value = event.target.value;
          setTextContent(value);

          const caretIndex = event.target.selectionStart ?? value.length;
          onTypingChange?.(value, caretIndex);
          emitDraft(value, images);
        }}
        onMouseUp={handleTextareaSelectionEvent}
        onKeyUp={handleTextareaSelectionEvent}
        autoFocus
        placeholder="What do you want to talk about?"
        style={{
          width: '100%',
          outline: 'none',
          border: '1px solid #e2e8f0',
          borderTop: 'none',
          borderRadius: images.length > 0 ? 0 : '0 0 8px 8px',
          padding: '12px',
          background: '#fff',
          color: '#333',
          fontFamily: 'inherit',
          fontSize: '14px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          resize: 'vertical',
          minHeight: 160,
        }}
      />

      <LinkedInEditorImageStrip images={images} onRemove={handleRemoveImage} />

      <input
        ref={fileInputRef}
        type="file"
        accept={LINKEDIN_PUBLISH_ACCEPTED_IMAGE_EXTENSIONS}
        style={{ display: 'none' }}
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

LinkedInAssistiveEditor.displayName = 'LinkedInAssistiveEditor';
