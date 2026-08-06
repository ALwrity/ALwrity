/**
 * Structured LinkedIn article editor — title, sections, and image strip.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Typography } from "@mui/material";
import { applyMarkdownFormat } from "../../../TextEditor/markdownFormatting";
import type { MarkdownFormatType } from "../../../TextEditor/markdownFormatting";
import type { LinkedInArticleDraftState } from "../../utils/linkedInArticleDraftUtils";
import {
  isIntroductionSection,
  normalizeArticleDraftState,
} from "../../utils/linkedInArticleIntroUtils";
import {
  appendImageToArticleDraftState,
  normalizeArticleImages,
  removeImageFromArticleDraftState,
} from "../../utils/linkedInArticleImageUtils";
import { useLinkedInEditorImageUpload } from "../../hooks/useLinkedInEditorImageUpload";
import { LINKEDIN_PUBLISH_ACCEPTED_IMAGE_EXTENSIONS } from "../../utils/linkedInPublishMediaConstants";
import { LinkedInEditorImageStrip } from "../LinkedInEditorImageStrip";
import { ArticleTitleField } from "./ArticleTitleField";
import { ArticleSectionPanel } from "./ArticleSectionPanel";
import { ArticleSectionBodyEditor } from "./ArticleSectionBodyEditor";
import { ArticleEditorToolbar } from "./ArticleEditorToolbar";
import { articleCanvasSx } from "./articleEditorStyles";

type ArticleDraftUpdater =
  | LinkedInArticleDraftState
  | ((prev: LinkedInArticleDraftState) => LinkedInArticleDraftState);

export interface ArticleEditorLayoutProps {
  state: LinkedInArticleDraftState;
  onChange: (updater: ArticleDraftUpdater) => void;
  onActiveSectionChange?: (sectionId: string | null) => void;
  onGenerateImage?: () => void;
  disabled?: boolean;
}

export const ArticleEditorLayout: React.FC<ArticleEditorLayoutProps> = ({
  state,
  onChange,
  onActiveSectionChange,
  onGenerateImage,
  disabled = false,
}) => {
  const sectionBodyRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    () => state.sections[0]?.id ?? null,
  );

  const { isUploading, uploadError, uploadImageFile, clearUploadError } =
    useLinkedInEditorImageUpload();

  const images = state.images || [];

  const applyChange = useCallback(
    (updater: ArticleDraftUpdater) => {
      onChange((prev) => {
        const base = prev;
        const next =
          typeof updater === "function"
            ? (updater as (p: LinkedInArticleDraftState) => LinkedInArticleDraftState)(
                base,
              )
            : updater;
        return normalizeArticleImages(next);
      });
    },
    [onChange],
  );

  useEffect(() => {
    if (!state.intro?.trim()) return;
    try {
      applyChange((prev) => normalizeArticleDraftState(prev));
      console.log("[ArticleEditorLayout] folded legacy intro into sections");
    } catch (error) {
      console.error("[ArticleEditorLayout] failed to normalize intro", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [state.intro, applyChange]);

  useEffect(() => {
    if (!state.coverImageUrl?.trim()) return;
    try {
      applyChange((prev) => normalizeArticleImages(prev));
      console.log("[ArticleEditorLayout] migrated legacy cover to image strip");
    } catch (error) {
      console.error("[ArticleEditorLayout] failed to migrate cover image", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [state.coverImageUrl, applyChange]);

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

  const patch = useCallback(
    (partial: Partial<LinkedInArticleDraftState>) => {
      applyChange((prev) => ({ ...prev, ...partial }));
    },
    [applyChange],
  );

  const updateSection = useCallback(
    (id: string, partial: Partial<{ heading: string; body: string }>) => {
      applyChange((prev) => ({
        ...prev,
        sections: prev.sections.map((section) =>
          section.id === id ? { ...section, ...partial } : section,
        ),
      }));
    },
    [applyChange],
  );

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
    [activeSection, updateSection],
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
    [activeSection, updateSection],
  );

  const handleUploadFile = useCallback(
    async (file: File) => {
      clearUploadError();
      try {
        const block = await uploadImageFile(file);
        if (block) {
          applyChange((prev) => appendImageToArticleDraftState(prev, block));
        }
      } catch (error) {
        console.error("[ArticleEditorLayout] image upload failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [clearUploadError, applyChange, uploadImageFile],
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
      applyChange((prev) => removeImageFromArticleDraftState(prev, imageId));
    },
    [applyChange],
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
              onUploadImage={() => fileInputRef.current?.click()}
              onGenerateImage={onGenerateImage}
              onInsertEmoji={handleInsertEmoji}
              disabled={disabled || !activeSection}
              isUploading={isUploading}
              hasImages={images.length > 0}
              sectionHeading={activeHeading}
            />

            <Box
              sx={{
                borderLeft: "1px solid #e2e8f0",
                borderRight: "1px solid #e2e8f0",
                bgcolor: "#fff",
                px: 1.25,
              }}
            >
              <LinkedInEditorImageStrip
                images={images}
                onRemove={handleRemoveImage}
              />
            </Box>

            {uploadError ? (
              <Alert severity="error" sx={{ mt: 1, fontSize: 13 }}>
                {uploadError}
              </Alert>
            ) : null}

            {activeSection ? (
              <Box
                sx={{
                  border: "1px solid #e2e8f0",
                  borderTop: images.length > 0 ? "1px solid #e2e8f0" : "none",
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
              applyChange((prev) => ({
                ...prev,
                sections: [...prev.sections, section],
              }));
              setActiveSectionId(section.id);
            }}
          />
        </Box>
      </Box>

      <input
        ref={fileInputRef}
        type="file"
        accept={LINKEDIN_PUBLISH_ACCEPTED_IMAGE_EXTENSIONS}
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />
    </Box>
  );
};
