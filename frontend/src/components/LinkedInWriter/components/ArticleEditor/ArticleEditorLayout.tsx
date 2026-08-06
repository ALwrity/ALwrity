/**
 * Structured LinkedIn article editor — cover, title, sections.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { applyMarkdownFormat } from "../../../TextEditor/markdownFormatting";
import type { MarkdownFormatType } from "../../../TextEditor/markdownFormatting";
import type { LinkedInArticleDraftState } from "../../utils/linkedInArticleDraftUtils";
import {
  isIntroductionSection,
  normalizeArticleDraftState,
} from "../../utils/linkedInArticleIntroUtils";
import { ArticleCoverBlock } from "./ArticleCoverBlock";
import { ArticleTitleField } from "./ArticleTitleField";
import { ArticleSectionPanel } from "./ArticleSectionPanel";
import { ArticleSectionBodyEditor } from "./ArticleSectionBodyEditor";
import { ArticleEditorToolbar } from "./ArticleEditorToolbar";
import { articleCanvasSx } from "./articleEditorStyles";

export interface ArticleEditorLayoutProps {
  state: LinkedInArticleDraftState;
  onChange: (state: LinkedInArticleDraftState) => void;
  onGenerateCover?: () => void;
  onUploadSectionImage?: () => void;
  onActiveSectionChange?: (sectionId: string | null) => void;
  disabled?: boolean;
}

export const ArticleEditorLayout: React.FC<ArticleEditorLayoutProps> = ({
  state,
  onChange,
  onGenerateCover,
  onUploadSectionImage,
  onActiveSectionChange,
  disabled = false,
}) => {
  const sectionBodyRef = useRef<HTMLTextAreaElement>(null);

  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    () => state.sections[0]?.id ?? null,
  );

  useEffect(() => {
    if (!state.intro?.trim()) return;
    try {
      const normalized = normalizeArticleDraftState(state);
      onChange(normalized);
      console.log("[ArticleEditorLayout] folded legacy intro into sections");
    } catch (error) {
      console.error("[ArticleEditorLayout] failed to normalize intro", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [state.intro, state, onChange]);

  const activeSection = useMemo(
    () =>
      state.sections.find((s) => s.id === activeSectionId) ??
      state.sections[0] ??
      null,
    [state.sections, activeSectionId],
  );

  const activeSectionIndex = useMemo(
    () =>
      activeSection
        ? state.sections.findIndex((section) => section.id === activeSection.id)
        : -1,
    [activeSection, state.sections],
  );

  const isActiveIntroduction =
    activeSection !== null &&
    activeSectionIndex >= 0 &&
    isIntroductionSection(activeSection, activeSectionIndex);

  useEffect(() => {
    onActiveSectionChange?.(activeSection?.id ?? null);
  }, [activeSection?.id, onActiveSectionChange]);

  const patch = (partial: Partial<LinkedInArticleDraftState>) => {
    onChange({ ...state, ...partial });
  };

  const updateSection = (
    id: string,
    partial: Partial<{ heading: string; body: string }>,
  ) => {
    onChange({
      ...state,
      sections: state.sections.map((s) =>
        s.id === id ? { ...s, ...partial } : s,
      ),
    });
  };

  const handleSelectSection = (id: string) => {
    setActiveSectionId(id);
  };

  const handleFormat = useCallback(
    (type: MarkdownFormatType) => {
      if (!activeSection) return;
      const textarea = sectionBodyRef.current;
      const result = applyMarkdownFormat(textarea, activeSection.body, type);
      if (!result) return;

      const { newValue, cursorPos } = result;
      updateSection(activeSection.id, { body: newValue });

      requestAnimationFrame(() => {
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(cursorPos, cursorPos);
        }
      });
    },
    [activeSection, state, onChange],
  );

  const handleInsertEmoji = useCallback(
    (emoji: string) => {
      if (!activeSection) return;
      const textarea = sectionBodyRef.current;
      const start = textarea?.selectionStart ?? activeSection.body.length;
      const end = textarea?.selectionEnd ?? activeSection.body.length;
      const newBody =
        activeSection.body.slice(0, start) +
        emoji +
        activeSection.body.slice(end);

      updateSection(activeSection.id, { body: newBody });

      requestAnimationFrame(() => {
        if (!textarea) return;
        textarea.focus();
        const pos = start + emoji.length;
        textarea.setSelectionRange(pos, pos);
      });
    },
    [activeSection, state, onChange],
  );

  const activeHeading = isActiveIntroduction
    ? "Introduction"
    : activeSection?.heading.trim() ||
      (activeSection
        ? `Section ${activeSectionIndex + 1}`
        : undefined);

  return (
    <Box
      data-testid="article-editor-layout"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        maxWidth: 960,
        mx: "auto",
        width: "100%",
        color: "#1e293b",
      }}
    >
      <ArticleCoverBlock
        coverImageUrl={state.coverImageUrl}
        imageSuggestions={state.imageSuggestions}
        onAddCover={onGenerateCover}
      />

      <Box sx={articleCanvasSx}>
        <ArticleTitleField
          value={state.title}
          onChange={(title) => patch({ title })}
          disabled={disabled}
        />

        {state.readingTime ? (
          <Typography variant="caption" sx={{ color: "#64748b", mt: 1, display: "block" }}>
            ~{state.readingTime} min read
          </Typography>
        ) : null}

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 2,
            alignItems: "flex-start",
            mt: 2,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0, width: "100%" }}>
            <ArticleEditorToolbar
              onFormat={handleFormat}
              onUploadImage={onUploadSectionImage}
              onInsertEmoji={handleInsertEmoji}
              disabled={disabled || !activeSection}
              sectionHeading={activeHeading}
            />

            {activeSection ? (
              <Box
                sx={{
                  border: "1px solid #e2e8f0",
                  borderTop: "none",
                  borderBottomLeftRadius: 8,
                  borderBottomRightRadius: 8,
                  bgcolor: "#ffffff",
                  p: { xs: 1.5, md: 2 },
                }}
              >
                <ArticleSectionBodyEditor
                  ref={sectionBodyRef}
                  heading={activeSection.heading}
                  value={activeSection.body}
                  onChange={(body) => updateSection(activeSection.id, { body })}
                  disabled={disabled}
                  isIntroduction={isActiveIntroduction}
                />
              </Box>
            ) : (
              <Typography
                sx={{
                  color: "#64748b",
                  fontStyle: "italic",
                  p: 2,
                  border: "1px solid #e2e8f0",
                  borderTop: "none",
                  borderRadius: "0 0 8px 8px",
                  bgcolor: "#f8fafc",
                }}
              >
                Add a section from the panel on the right to start writing.
              </Typography>
            )}
          </Box>

          <ArticleSectionPanel
            sections={state.sections}
            activeSectionId={activeSection?.id ?? null}
            onSelectSection={handleSelectSection}
            onRenameSection={(id, heading) => updateSection(id, { heading })}
            onAddSection={(section) => {
              onChange({ ...state, sections: [...state.sections, section] });
              setActiveSectionId(section.id);
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};
