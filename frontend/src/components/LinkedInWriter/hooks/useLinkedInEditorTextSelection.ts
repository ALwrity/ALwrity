import { useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import useTextSelectionHandler from '../../TextEditor/TextSelectionHandler';

interface LinkedInEditorTextSelectionOptions {
  enabled: boolean;
  onGenerateImage?: (text: string) => void;
  isGeneratingImage?: boolean;
  onGenerateVideo?: (text: string) => void;
  isGeneratingVideo?: boolean;
}

const MIN_SELECTION_LENGTH = 10;

/**
 * LinkedIn Studio text selection handler for assistive writing (textarea edit mode).
 * Keeps selection menu logic separate from preview/read-only HTML rendering.
 */
export function useLinkedInEditorTextSelection(
  contentRef: RefObject<HTMLDivElement>,
  options: LinkedInEditorTextSelectionOptions,
) {
  const {
    enabled,
    onGenerateImage,
    isGeneratingImage = false,
    onGenerateVideo,
    isGeneratingVideo = false,
  } = options;

  const selectionHandler = useTextSelectionHandler(contentRef, {
    onGenerateImage,
    isGeneratingImage,
    onGenerateVideo,
    isGeneratingVideo,
  });

  const { setSelectionMenu, renderSelectionMenu } = selectionHandler;

  const handleTextareaSelection = useCallback(
    (textarea: HTMLTextAreaElement) => {
      if (!enabled) {
        setSelectionMenu(null);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (start === end) {
        setSelectionMenu(null);
        return;
      }

      const text = textarea.value.substring(start, end).trim();
      if (text.length < MIN_SELECTION_LENGTH) {
        setSelectionMenu(null);
        return;
      }

      const elRect = textarea.getBoundingClientRect();
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 22;
      const linesBefore = textarea.value.substring(0, start).split('\n').length - 1;
      const x = Math.max(8, elRect.left + elRect.width / 2);
      const y = Math.max(8, elRect.top + linesBefore * lineHeight + 10);

      setSelectionMenu({ x, y, text });
    },
    [enabled, setSelectionMenu],
  );

  useEffect(() => {
    if (!enabled) {
      setSelectionMenu(null);
    }
  }, [enabled, setSelectionMenu]);

  return {
    ...selectionHandler,
    handleTextareaSelection,
    renderSelectionMenu,
  };
}
