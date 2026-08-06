/**
 * Article editor content — mirrors post ContentDisplayArea assistive/preview flow.
 */

import React from "react";
import { Box } from "@mui/material";
import { LinkedInDraftPreview } from "../LinkedInDraftPreview";
import { LinkedInArticleLivePreview } from "../LinkedInArticleLivePreview";
import LinkedInAssistiveWritingCard from "../LinkedInAssistiveWritingCard";
import type { LinkedInPreviewMode } from "../LinkedInPreviewModeToggle";
import type { LinkedInArticleDraftState } from "../../utils/linkedInArticleDraftUtils";
import type { LinkedInAssistiveSuggestion } from "../../services/linkedInAssistiveWritingApi";
import { ArticleEditorLayout } from "./ArticleEditorLayout";

type ArticleDraftUpdater =
  | LinkedInArticleDraftState
  | ((prev: LinkedInArticleDraftState) => LinkedInArticleDraftState);

interface AssistiveWritingState {
  suggestion: LinkedInAssistiveSuggestion | null;
  error: string | null;
  isGenerating: boolean;
  showContinuePrompt: boolean;
  suggestionIndex: number;
  totalSuggestions: number;
  onAccept: () => void;
  onReject: () => void;
  onNext: () => void;
  onContinueWriting: () => void;
  onDismiss: () => void;
}

export interface ArticleEditorContentAreaProps {
  contentRef: React.RefObject<HTMLDivElement>;
  articleDraftState: LinkedInArticleDraftState;
  onArticleDraftChange: (updater: ArticleDraftUpdater) => void;
  previewMode: LinkedInPreviewMode;
  draftMarkdown: string;
  citations?: unknown[];
  researchSources?: unknown[];
  isGenerating: boolean;
  loadingMessage: string;
  assistantOn: boolean;
  assistiveWriting?: AssistiveWritingState;
  onGenerateImage?: () => void;
  renderSelectionMenu?: () => React.ReactNode;
}

export const ArticleEditorContentArea: React.FC<ArticleEditorContentAreaProps> = ({
  contentRef,
  articleDraftState,
  onArticleDraftChange,
  previewMode,
  draftMarkdown,
  citations,
  researchSources,
  isGenerating,
  loadingMessage,
  assistantOn,
  assistiveWriting,
  onGenerateImage,
  renderSelectionMenu,
}) => {
  const hasContent =
    Boolean(draftMarkdown.trim()) || Boolean(articleDraftState.title.trim());

  return (
    <div
      ref={contentRef}
      data-testid="article-content-area"
      style={{
        padding: "20px",
        lineHeight: 1.6,
        position: "relative",
        userSelect: "text",
        overflow: "visible",
        color: "#333",
      }}
    >
      {assistiveWriting ? (
        <LinkedInAssistiveWritingCard
          enabled={assistantOn}
          suggestion={assistiveWriting.suggestion}
          error={assistiveWriting.error}
          isGenerating={assistiveWriting.isGenerating}
          showContinuePrompt={assistiveWriting.showContinuePrompt}
          suggestionIndex={assistiveWriting.suggestionIndex}
          totalSuggestions={assistiveWriting.totalSuggestions}
          onAccept={assistiveWriting.onAccept}
          onReject={assistiveWriting.onReject}
          onNext={assistiveWriting.onNext}
          onContinueWriting={assistiveWriting.onContinueWriting}
          onDismiss={assistiveWriting.onDismiss}
        />
      ) : null}

      {isGenerating ? (
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            zIndex: 10,
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              border: "3px solid #e1f5fe",
              borderTop: "3px solid #0a66c2",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              mx: "auto",
              mb: 2,
            }}
          />
          <Box sx={{ color: "#0277bd", fontSize: 16, fontWeight: 500, mb: 1 }}>
            {loadingMessage || "Generating LinkedIn article..."}
          </Box>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </Box>
      ) : null}

      <Box sx={{ opacity: isGenerating ? 0.3 : 1, transition: "opacity 0.3s ease" }}>
        {!hasContent ? (
          <p
            style={{
              color: "#666",
              fontStyle: "italic",
              textAlign: "center",
              marginTop: "40px",
            }}
          >
            Content will appear here when generated. Enable Assistive Writing to
            edit sections, or use preview modes to review your article.
          </p>
        ) : assistantOn ? (
          <Box data-testid="article-assistive-editor">
            <ArticleEditorLayout
              state={articleDraftState}
              onChange={onArticleDraftChange}
              onGenerateImage={onGenerateImage}
              disabled={isGenerating}
            />
            {previewMode === "linkedin" ? (
              <Box sx={{ mt: 2 }} data-testid="article-linkedin-preview">
                <LinkedInArticleLivePreview
                  state={articleDraftState}
                  draftMarkdown={draftMarkdown}
                />
              </Box>
            ) : null}
            {renderSelectionMenu?.()}
          </Box>
        ) : previewMode === "studio" ? (
          <Box data-testid="article-citation-preview">
            <LinkedInDraftPreview
              draft={draftMarkdown}
              citations={citations}
              researchSources={researchSources}
            />
          </Box>
        ) : (
          <Box data-testid="article-linkedin-preview">
            <LinkedInArticleLivePreview
              state={articleDraftState}
              draftMarkdown={draftMarkdown}
            />
          </Box>
        )}
      </Box>
    </div>
  );
};
