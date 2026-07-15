import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  CitationHoverHandler,
  useTextSelectionHandler,
  DiffPreviewModal,
  ContentPreviewHeaderWithModals,
  ContentDisplayArea
} from '../../TextEditor';
import { GroundingDataDisplay } from './GroundingDataDisplay';
import { readPrefs } from '../utils/linkedInWriterUtils';
import { useLinkedInSelectionImage } from '../hooks/useLinkedInSelectionImage';
import { useLinkedInSelectionVideo } from '../hooks/useLinkedInSelectionVideo';
import { useLinkedInAssistiveWriting } from '../hooks/useLinkedInAssistiveWriting';
import { LinkedInSelectionImageModal } from './LinkedInSelectionImageModal';
import { LinkedInSelectionVideoModal } from './LinkedInSelectionVideoModal';

interface ContentEditorProps {
  isPreviewing: boolean;
  pendingEdit: { src: string; target: string } | null;
  livePreviewHtml: string;
  draft: string;
  showPreview: boolean;
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
  onPreviewToggle: () => void;
  topic?: string;
}

const ContentEditor: React.FC<ContentEditorProps> = ({
  isPreviewing,
  pendingEdit,
  livePreviewHtml,
  draft,
  showPreview,
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
  onPreviewToggle,
  topic
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [assistantOn, setAssistantOn] = useState(false);

  const getTextarea = useCallback(
    () => contentRef.current?.querySelector('textarea') ?? null,
    [],
  );

  const handleInsertAtCaret = useCallback(
    (text: string, caretIndex: number) => {
      const beforeCaret = draft.slice(0, caretIndex);
      const afterCaret = draft.slice(caretIndex);
      const insertion = ` ${text.trim()} `;
      const newDraft = beforeCaret + insertion + afterCaret;

      window.dispatchEvent(
        new CustomEvent('linkedinwriter:applyEdit', {
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

  const prefs = readPrefs();
  const selectionImage = useLinkedInSelectionImage({
    topic,
    industry: prefs.industry,
  });

  const selectionVideo = useLinkedInSelectionVideo({
    topic,
    industry: prefs.industry,
  });

  const textSelectionHandler = useTextSelectionHandler(contentRef, {
    onGenerateImage: selectionImage.openForSelection,
    isGeneratingImage: selectionImage.isGenerating,
    onGenerateVideo: selectionVideo.openForSelection,
    isGeneratingVideo: selectionVideo.isGenerating,
  });

  useEffect(() => {
    const handleReplaceSelectedText = (event: CustomEvent) => {
      const { originalText, editedText, editType } = event.detail;
      const textarea = contentRef.current?.querySelector('textarea');

      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = textarea.value.substring(start, end);

        if (selectedText.trim() === originalText.trim()) {
          const newValue = textarea.value.substring(0, start) + editedText + textarea.value.substring(end);
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

      console.log(`✅ [ContentEditor] Quick edit "${editType}" applied successfully`);
    };

    window.addEventListener('linkedinwriter:replaceSelectedText', handleReplaceSelectedText as EventListener);
    return () => {
      window.removeEventListener('linkedinwriter:replaceSelectedText', handleReplaceSelectedText as EventListener);
    };
  }, [draft, onDraftChange]);

  useEffect(() => {
    if (draft && !showPreview) {
      onPreviewToggle();
    }
  }, [draft, showPreview, onPreviewToggle]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <DiffPreviewModal
        isPreviewing={isPreviewing}
        pendingEdit={pendingEdit}
        livePreviewHtml={livePreviewHtml}
        onConfirmChanges={onConfirmChanges}
        onDiscardChanges={onDiscardChanges}
      />

      <div style={{ flex: 1, padding: '24px', overflow: 'visible' }}>
        {showPreview && (
          <div
            style={{
              border: '1px solid #e1f5fe',
              borderRadius: '8px',
              background: '#f8fdff',
              overflow: 'visible',
            }}
          >
            <ContentPreviewHeaderWithModals
              researchSources={researchSources}
              citations={citations}
              searchQueries={searchQueries}
              qualityMetrics={qualityMetrics}
              draft={draft}
              showPreview={showPreview}
              onPreviewToggle={onPreviewToggle}
              assistantOn={assistantOn}
              onAssistantToggle={setAssistantOn}
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
              onTextSelection={textSelectionHandler.handleTextSelection}
              renderSelectionMenu={textSelectionHandler.renderSelectionMenu}
              onTypingChange={assistiveWriting.handleTypingChange}
            />

            <GroundingDataDisplay
              researchSources={researchSources || []}
              citations={citations || []}
              qualityMetrics={qualityMetrics}
              groundingEnabled={groundingEnabled || false}
            />
          </div>
        )}
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
