import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  CitationHoverHandler,
  DiffPreviewModal,
  ContentPreviewHeaderWithModals,
  ContentDisplayArea,
} from "../../TextEditor";
import { GroundingDataDisplay } from "./GroundingDataDisplay";
import { readPrefs } from "../utils/linkedInWriterUtils";
import { useLinkedInSelectionImage } from "../hooks/useLinkedInSelectionImage";
import { useLinkedInSelectionVideo } from "../hooks/useLinkedInSelectionVideo";
import { useLinkedInAssistiveWriting } from "../hooks/useLinkedInAssistiveWriting";
import { useLinkedInEditorTextSelection } from "../hooks/useLinkedInEditorTextSelection";
import { appendImageMarkdownToDraft } from "../utils/linkedInImageDraftUtils";
import type { LinkedInAssistiveEditorHandle } from "./LinkedInAssistiveEditor";
import { LinkedInSelectionImageModal } from "./LinkedInSelectionImageModal";
import { LinkedInSelectionVideoModal } from "./LinkedInSelectionVideoModal";
import { type LinkedInPreviewMode } from './LinkedInPreviewModeToggle';

interface ContentEditorProps {
  isPreviewing: boolean;
  pendingEdit: { src: string; target: string } | null;
  livePreviewHtml: string;
  draft: string;
  isGenerating: boolean;
  loadingMessage: string;
  researchSources?: any[];
  citations?: any[];
  qualityMetrics?: any;
  groundingEnabled?: boolean;
  searchQueries?: string[];
  onConfirmChanges: () => void;
  onDiscardChanges: () => void;
  onDraftChange: (value: string) => void;
  topic?: string;
  assistiveEditorRef?: React.Ref<LinkedInAssistiveEditorHandle>;
  previewMode?: LinkedInPreviewMode;
  onPreviewModeChange?: (mode: LinkedInPreviewMode) => void;
}

const ContentEditor: React.FC<ContentEditorProps> = ({
  isPreviewing,
  pendingEdit,
  livePreviewHtml,
  draft,
  isGenerating,
  loadingMessage,
  researchSources,
  citations,
  qualityMetrics,
  groundingEnabled,
  searchQueries,
  onConfirmChanges,
  onDiscardChanges,
  onDraftChange,
  topic,
  assistiveEditorRef,
  previewMode: externalPreviewMode,
  onPreviewModeChange,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [assistantOn, setAssistantOn] = useState(false);
  const [previewMode, setPreviewMode] = useState<LinkedInPreviewMode>(
    externalPreviewMode || 'studio'
  );

  // Sync external preview mode when controlled
  const effectivePreviewMode = onPreviewModeChange ? (externalPreviewMode ?? 'linkedin') : previewMode;
  const effectiveSetPreviewMode = onPreviewModeChange || setPreviewMode;

  const getTextarea = useCallback(
    () => contentRef.current?.querySelector("textarea") ?? null,
    [],
  );

  const flushAssistiveDraft = useCallback(() => {
    if (assistiveEditorRef && typeof assistiveEditorRef !== "function") {
      const flushed = assistiveEditorRef.current?.flushDraft();
      if (typeof flushed === "string") {
        onDraftChange(flushed);
        return flushed;
      }
    }
    return draft;
  }, [draft, onDraftChange, assistiveEditorRef]);

  const handleAssistantToggle = useCallback(
    (enabled: boolean) => {
      if (!enabled && assistantOn) {
        flushAssistiveDraft();
      }
      setAssistantOn(enabled);
    },
    [assistantOn, flushAssistiveDraft],
  );

  const handlePreviewModeChange = useCallback(
    (mode: LinkedInPreviewMode) => {
      if (assistantOn) {
        flushAssistiveDraft();
      }
      effectiveSetPreviewMode(mode);
    },
    [assistantOn, flushAssistiveDraft, effectiveSetPreviewMode],
  );

  const handleInsertAtCaret = useCallback(
    (text: string, caretIndex: number) => {
      const beforeCaret = draft.slice(0, caretIndex);
      const afterCaret = draft.slice(caretIndex);
      const insertion = ` ${text.trim()} `;
      const newDraft = beforeCaret + insertion + afterCaret;

      window.dispatchEvent(
        new CustomEvent("linkedinwriter:applyEdit", {
          detail: { src: draft, target: newDraft },
        }),
      );
    },
    [draft],
  );

  const assistiveWriting = useLinkedInAssistiveWriting({
    enabled: assistantOn,
    draft,
    getTextarea,
    onDraftChange,
    onInsertWithPreview: handleInsertAtCaret,
  });

  const insertGeneratedImage = useCallback(
    (imageUrl: string) => {
      // Prefer flushed assistive text so a pending debounce cannot drop the image.
      let baseDraft = draft;
      if (assistiveEditorRef && typeof assistiveEditorRef !== "function") {
        const flushed = assistiveEditorRef.current?.flushDraft();
        if (typeof flushed === "string") {
          baseDraft = flushed;
        }
      }
      const newDraft = appendImageMarkdownToDraft(baseDraft, imageUrl);
      console.log("[ContentEditor] image inserted into draft", {
        draftLength: newDraft.length,
      });
      onDraftChange(newDraft);
    },
    [draft, onDraftChange, assistiveEditorRef],
  );

  const prefs = readPrefs();
  const selectionImage = useLinkedInSelectionImage({
    topic,
    industry: prefs.industry,
    onInsertImage: insertGeneratedImage,
  });

  const selectionVideo = useLinkedInSelectionVideo({
    topic,
    industry: prefs.industry,
  });

  const textSelectionHandler = useLinkedInEditorTextSelection(contentRef, {
    enabled: assistantOn,
    onGenerateImage: selectionImage.openForSelection,
    isGeneratingImage: selectionImage.isGenerating,
    onGenerateVideo: selectionVideo.openForSelection,
    isGeneratingVideo: selectionVideo.isGenerating,
  });

  useEffect(() => {
    const handleReplaceSelectedText = (event: CustomEvent) => {
      const { originalText, editedText, editType } = event.detail;
      const textarea = contentRef.current?.querySelector("textarea");

      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);

        if (selectedText.trim() === originalText.trim()) {
          const newValue =
            textarea.value.substring(0, start) +
            editedText +
            textarea.value.substring(end);
          onDraftChange(newValue);

          setTimeout(() => {
            const newCursorPos = start + editedText.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
            textarea.focus();
          }, 0);
        } else {
          onDraftChange(draft.replace(originalText, editedText));
        }
      } else {
        onDraftChange(draft.replace(originalText, editedText));
      }

      console.log(
        `✅ [ContentEditor] Quick edit "${editType}" applied successfully`,
      );
    };

    window.addEventListener(
      "linkedinwriter:replaceSelectedText",
      handleReplaceSelectedText as EventListener,
    );
    return () => {
      window.removeEventListener(
        "linkedinwriter:replaceSelectedText",
        handleReplaceSelectedText as EventListener,
      );
    };
  }, [draft, onDraftChange]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <DiffPreviewModal
        isPreviewing={isPreviewing}
        pendingEdit={pendingEdit}
        livePreviewHtml={livePreviewHtml}
        onConfirmChanges={onConfirmChanges}
        onDiscardChanges={onDiscardChanges}
      />

      <div style={{ flex: 1, padding: "24px", overflow: "visible" }}>
          <div
            style={{
              border: "1px solid #e1f5fe",
              borderRadius: "8px",
              background: "#f8fdff",
              overflow: "visible",
            }}
          >
            <ContentPreviewHeaderWithModals
              researchSources={researchSources}
              citations={citations}
              searchQueries={searchQueries}
              qualityMetrics={qualityMetrics}
              draft={draft}
              previewMode={effectivePreviewMode}
              onPreviewModeChange={handlePreviewModeChange}
              assistantOn={assistantOn}
              onAssistantToggle={handleAssistantToggle}
              topic={topic}
            />

            <ContentDisplayArea
              contentRef={contentRef}
              draft={draft}
              isGenerating={isGenerating}
              loadingMessage={loadingMessage}
              citations={citations}
              researchSources={researchSources}
              assistantOn={assistantOn}
              previewMode={effectivePreviewMode}
              onPreviewModeChange={handlePreviewModeChange}
              assistiveWriting={{
                suggestion: assistiveWriting.suggestion,
                error: assistiveWriting.error,
                isGenerating: assistiveWriting.isGenerating,
                showContinuePrompt: assistiveWriting.showContinuePrompt,
                suggestionIndex: assistiveWriting.suggestionIndex,
                totalSuggestions: assistiveWriting.allSuggestions.length,
                onAccept: assistiveWriting.handleAcceptSuggestion,
                onReject: assistiveWriting.handleRejectSuggestion,
                onNext: assistiveWriting.handleNextSuggestion,
                onContinueWriting: assistiveWriting.handleContinueWriting,
                onDismiss: assistiveWriting.dismissSuggestion,
              }}
              onDraftChange={onDraftChange}
              onTextareaSelection={textSelectionHandler.handleTextareaSelection}
              renderSelectionMenu={textSelectionHandler.renderSelectionMenu}
              onTypingChange={assistiveWriting.handleTypingChange}
              assistiveEditorRef={assistiveEditorRef}
            />

            <GroundingDataDisplay
              researchSources={researchSources || []}
              citations={citations || []}
              qualityMetrics={qualityMetrics}
              groundingEnabled={groundingEnabled || false}
            />
          </div>
      </div>

      <CitationHoverHandler researchSources={researchSources || []} />

      <LinkedInSelectionImageModal
        open={selectionImage.modalOpen}
        onClose={selectionImage.closeModal}
        onGenerate={selectionImage.handleGenerate}
        initialPrompt={selectionImage.initialPrompt}
        isGenerating={selectionImage.isGenerating}
        generatedPreview={selectionImage.generatedPreview}
        onClosePreview={selectionImage.closePreview}
      />

      <LinkedInSelectionVideoModal
        open={selectionVideo.modalOpen}
        onClose={selectionVideo.closeModal}
        onGenerate={selectionVideo.handleGenerate}
        initialPrompt={selectionVideo.initialPrompt}
        isGenerating={selectionVideo.isGenerating}
        generatedPreview={selectionVideo.generatedPreview}
        onClosePreview={selectionVideo.closePreview}
      />
    </div>
  );
};

export { ContentEditor };
