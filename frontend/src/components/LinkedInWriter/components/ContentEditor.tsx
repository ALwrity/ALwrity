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
import { insertImageIntoLinkedInDraft } from "../utils/linkedInDraftImageInsert";
import { splitDraftForAssistiveEditor, mergeAssistiveEditorDraft } from "../utils/linkedInEditorDraftUtils";
import type { AssistiveTextHighlightRange } from "../utils/linkedInAssistiveHighlightUtils";
import { diffMarkup } from "../utils/contentFormatters";
import type { LinkedInAssistiveEditorHandle } from "./LinkedInAssistiveEditor";
import { LinkedInConfirmedEditHighlight } from "./LinkedInConfirmedEditHighlight";
import { LinkedInSelectionImageModal } from "./LinkedInSelectionImageModal";
import { LinkedInSelectionVideoModal } from "./LinkedInSelectionVideoModal";
import { type LinkedInPreviewMode } from './LinkedInPreviewModeToggle';
import type { LinkedInDraftContentType } from '../utils/linkedInDraftLibraryUtils';
import { resolveEditorShellMode } from '../utils/linkedInEditorShellUtils';
import { ArticleEditorContentArea } from './ArticleEditor/ArticleEditorContentArea';
import type { LinkedInArticleDraftState } from '../utils/linkedInArticleDraftUtils';
import { articleStateToMarkdown, parseMarkdownToArticleDraft } from '../utils/linkedInArticleDraftUtils';
import {
  appendImageToArticleDraftState,
  createArticleImageBlockFromUrl,
} from '../utils/linkedInArticleImageUtils';
import { buildToolbarImageSeedFromDraft } from '../utils/linkedInToolbarImageSeed';

interface ContentEditorProps {
  isPreviewing: boolean;
  pendingEdit: { src: string; target: string } | null;
  livePreviewHtml: string;
  draft: string;
  /** Session content type — drives editor shell mode (PR3+). */
  draftContentType?: LinkedInDraftContentType;
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
  articleDraftState?: LinkedInArticleDraftState | null;
  onArticleDraftChange?: (
    updater:
      | LinkedInArticleDraftState
      | ((prev: LinkedInArticleDraftState) => LinkedInArticleDraftState),
  ) => void;
}

const ContentEditor: React.FC<ContentEditorProps> = ({
  isPreviewing,
  pendingEdit,
  livePreviewHtml,
  draft,
  draftContentType,
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
  articleDraftState = null,
  onArticleDraftChange,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [assistantOn, setAssistantOn] = useState(false);
  const [assistiveHighlightRange, setAssistiveHighlightRange] =
    useState<AssistiveTextHighlightRange | null>(null);
  const [confirmedEditHighlightHtml, setConfirmedEditHighlightHtml] =
    useState<string | null>(null);
  const pendingInsertHighlightRef = useRef<AssistiveTextHighlightRange | null>(
    null,
  );
  const [previewMode, setPreviewMode] = useState<LinkedInPreviewMode>(
    externalPreviewMode || 'studio'
  );

  // Sync external preview mode when controlled
  const shellMode = resolveEditorShellMode(draftContentType);
  const previewModeFromState = onPreviewModeChange
    ? (externalPreviewMode ?? "linkedin")
    : previewMode;
  const effectivePreviewMode: LinkedInPreviewMode = previewModeFromState;
  const effectiveSetPreviewMode = onPreviewModeChange || setPreviewMode;

  const articleMarkdown =
    shellMode === "article" && articleDraftState
      ? articleStateToMarkdown(articleDraftState)
      : draft;

  const headerDraft = shellMode === "article" ? articleMarkdown : draft;

  useEffect(() => {
    console.log("[ContentEditor] editor shell mode", {
      shellMode,
      draftContentType,
      effectivePreviewMode,
    });
  }, [shellMode, draftContentType, effectivePreviewMode]);

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
      if (assistantOn) {
        flushAssistiveDraft();
      }
      setAssistantOn(enabled);
      console.log("[ContentEditor] assistive writing toggled", { enabled });
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
      const currentDraft = flushAssistiveDraft();
      const parsed = splitDraftForAssistiveEditor(currentDraft);
      const textBefore = parsed.textContent.slice(0, caretIndex);
      const textAfter = parsed.textContent.slice(caretIndex);
      const insertion = ` ${text.trim()} `;
      const newTextContent = textBefore + insertion + textAfter;
      const newDraft = mergeAssistiveEditorDraft(
        newTextContent,
        parsed.images,
      );

      const highlightStart = textBefore.length;
      const highlightEnd = highlightStart + insertion.length;
      pendingInsertHighlightRef.current = {
        start: highlightStart,
        end: highlightEnd,
      };

      window.dispatchEvent(
        new CustomEvent("linkedinwriter:applyEdit", {
          detail: { src: currentDraft, target: newDraft },
        }),
      );
    },
    [flushAssistiveDraft],
  );

  const handleConfirmChanges = useCallback(() => {
    const pendingRange = pendingInsertHighlightRef.current;
    if (pendingRange) {
      pendingInsertHighlightRef.current = null;
      onConfirmChanges();
      requestAnimationFrame(() => {
        setAssistiveHighlightRange(pendingRange);
        console.log("[ContentEditor] in-editor highlight after confirm", {
          range: pendingRange,
        });
      });
      return;
    }

    if (pendingEdit) {
      try {
        setConfirmedEditHighlightHtml(
          diffMarkup(pendingEdit.src, pendingEdit.target),
        );
      } catch (err) {
        console.warn("[ContentEditor] diffMarkup failed for confirm panel", err);
      }
    }
    onConfirmChanges();
  }, [onConfirmChanges, pendingEdit]);

  const clearAssistiveHighlight = useCallback(() => {
    setAssistiveHighlightRange(null);
  }, []);

  const clearConfirmedEditHighlight = useCallback(() => {
    setConfirmedEditHighlightHtml(null);
  }, []);

  useEffect(() => {
    if (isPreviewing) {
      setConfirmedEditHighlightHtml(null);
    }
  }, [isPreviewing]);

  const handleDraftChangeForAssistive = useCallback(
    (value: string) => {
      if (shellMode === "article" && onArticleDraftChange) {
        try {
          const parsed = parseMarkdownToArticleDraft(value);
          if (parsed) {
            onArticleDraftChange(parsed);
            console.log("[ContentEditor] synced assistive draft to article state", {
              titleLength: parsed.title.length,
              sectionCount: parsed.sections.length,
            });
          }
        } catch (error) {
          console.error("[ContentEditor] failed to parse assistive draft for article", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return;
      }
      onDraftChange(value);
    },
    [shellMode, onArticleDraftChange, onDraftChange],
  );

  const assistiveDraft = shellMode === "article" ? articleMarkdown : draft;

  const assistiveWriting = useLinkedInAssistiveWriting({
    enabled: assistantOn,
    draft: assistiveDraft,
    getTextarea,
    onDraftChange: handleDraftChangeForAssistive,
    onInsertWithPreview: shellMode === "post" ? handleInsertAtCaret : undefined,
    researchSources,
  });

  const insertGeneratedImage = useCallback(
    (imageUrl: string) => {
      if (shellMode === "article" && articleDraftState && onArticleDraftChange) {
        try {
          const block = createArticleImageBlockFromUrl(imageUrl, "Article image");
          onArticleDraftChange((prev) =>
            appendImageToArticleDraftState(prev, block),
          );
          console.log("[ContentEditor] appended image to article draft strip", {
            imageUrl: imageUrl.substring(0, 80),
            imageCount: (articleDraftState.images?.length ?? 0) + 1,
          });
        } catch (error) {
          console.error("[ContentEditor] failed to append article image", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return;
      }
      try {
        const newDraft = insertImageIntoLinkedInDraft(draft, imageUrl, {
          flushDraft: () => {
            if (
              assistiveEditorRef &&
              typeof assistiveEditorRef !== "function"
            ) {
              return assistiveEditorRef.current?.flushDraft();
            }
            return undefined;
          },
        });
        console.log("[ContentEditor] image inserted into draft", {
          draftLength: newDraft.length,
        });
        onDraftChange(newDraft);
      } catch (error) {
        console.error("[ContentEditor] failed to insert generated image", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [
      draft,
      onDraftChange,
      assistiveEditorRef,
      shellMode,
      articleDraftState,
      onArticleDraftChange,
    ],
  );

  const prefs = readPrefs();
  const selectionImage = useLinkedInSelectionImage({
    topic,
    industry: prefs.industry,
    onInsertImage: insertGeneratedImage,
  });

  const handleOpenArticleImageGenerator = useCallback(() => {
    try {
      const { seedText, prompt } = buildToolbarImageSeedFromDraft(
        articleMarkdown,
        topic,
        prefs.industry,
      );
      console.log("[ContentEditor] opening article image generator", {
        seedLength: seedText.length,
      });
      selectionImage.openForDraft(seedText, prompt);
    } catch (error) {
      console.error("[ContentEditor] failed to open article image generator", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [articleMarkdown, topic, prefs.industry, selectionImage]);

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
    <div
      data-testid="linkedin-content-editor"
      data-editor-mode={shellMode}
      style={{ flex: 1, display: "flex", flexDirection: "column" }}
    >
      <DiffPreviewModal
        isPreviewing={isPreviewing}
        pendingEdit={pendingEdit}
        livePreviewHtml={livePreviewHtml}
        onConfirmChanges={handleConfirmChanges}
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
              draft={headerDraft}
              previewMode={effectivePreviewMode}
              onPreviewModeChange={handlePreviewModeChange}
              assistantOn={assistantOn}
              onAssistantToggle={handleAssistantToggle}
              topic={topic}
            />

            <LinkedInConfirmedEditHighlight
              html={confirmedEditHighlightHtml}
              onDismiss={clearConfirmedEditHighlight}
            />

            {shellMode === "article" && articleDraftState && onArticleDraftChange ? (
              <ArticleEditorContentArea
                contentRef={contentRef}
                articleDraftState={articleDraftState}
                onArticleDraftChange={onArticleDraftChange}
                previewMode={effectivePreviewMode}
                draftMarkdown={articleMarkdown}
                citations={citations}
                researchSources={researchSources}
                isGenerating={isGenerating}
                loadingMessage={loadingMessage}
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
                onGenerateImage={handleOpenArticleImageGenerator}
                renderSelectionMenu={textSelectionHandler.renderSelectionMenu}
              />
            ) : (
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
              assistiveHighlightRange={assistiveHighlightRange}
              onAssistiveHighlightClear={clearAssistiveHighlight}
            />
            )}

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
