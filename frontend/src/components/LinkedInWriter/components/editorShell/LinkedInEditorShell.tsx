/**
 * Routes LinkedIn Studio editor chrome to post or article shell by content type.
 */

import React, { useEffect } from "react";
import { resolveEditorShellMode } from "../../utils/linkedInEditorShellUtils";
import type { LinkedInDraftContentType } from "../../utils/linkedInDraftLibraryUtils";
import type { LinkedInPreviewMode } from "../LinkedInPreviewModeToggle";
import { ArticleEditorShell } from "./ArticleEditorShell";
import { PostEditorShell } from "./PostEditorShell";
import type { EditorSaveStatus } from "./EditorChromeShared";

const LOG_PREFIX = "[LinkedInEditorShell]";

export interface LinkedInEditorShellProps {
  draft: string;
  draftContentType?: LinkedInDraftContentType;
  onBackToDashboard: () => void;
  saveStatus: EditorSaveStatus;
  onSave: () => void;
  onOpenQualityCheck: () => void;
  researchSources?: unknown[];
  citations?: unknown[];
  searchQueries?: string[];
  previewMode: LinkedInPreviewMode;
  onPreviewModeChange: (mode: LinkedInPreviewMode) => void;
  getDraftForPublish?: () => string;
  onInsertImageIntoDraft?: (imageUrl: string) => void;
  topic?: string;
}

export const LinkedInEditorShell: React.FC<LinkedInEditorShellProps> = (
  props,
) => {
  const {
    draft,
    draftContentType,
    onBackToDashboard,
    saveStatus,
    onSave,
    onOpenQualityCheck,
    researchSources,
    citations,
    searchQueries,
    previewMode,
    onPreviewModeChange,
    getDraftForPublish,
    onInsertImageIntoDraft,
    topic,
  } = props;

  const shellMode = resolveEditorShellMode(draftContentType);

  const sharedProps = {
    draft,
    onBackToDashboard,
    saveStatus,
    onSave,
    onOpenQualityCheck,
    researchSources,
    citations,
    searchQueries,
  };

  useEffect(() => {
    console.log(`${LOG_PREFIX} editor shell mode`, {
      shellMode,
      draftContentType,
    });
  }, [shellMode, draftContentType]);

  if (shellMode === "article") {
    return (
      <ArticleEditorShell
        {...sharedProps}
        draftContentType={draftContentType}
        previewMode={previewMode}
        onPreviewModeChange={onPreviewModeChange}
        getDraftForPublish={getDraftForPublish}
        onInsertImageIntoDraft={onInsertImageIntoDraft}
        topic={topic}
      />
    );
  }

  return (
    <PostEditorShell
      {...sharedProps}
      draftContentType={draftContentType}
      previewMode={previewMode}
      onPreviewModeChange={onPreviewModeChange}
      getDraftForPublish={getDraftForPublish}
      onInsertImageIntoDraft={onInsertImageIntoDraft}
      topic={topic}
    />
  );
};
