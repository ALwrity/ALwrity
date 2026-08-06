/**
 * Post editor chrome — feed preview toggle and publish controls.
 */

import React from "react";
import { ThemeProvider } from "@mui/material/styles";
import PublishLinkedInPanel from "../PublishLinkedInPanel";
import type { LinkedInDraftContentType } from "../../utils/linkedInDraftLibraryUtils";
import type { LinkedInPreviewMode } from "../LinkedInPreviewModeToggle";
import {
  EditorChromeShared,
  type EditorChromeSharedProps,
} from "./EditorChromeShared";
import { EditorPreviewModeToggle } from "./EditorPreviewModeToggle";
import { editorShellTheme, editorShellToolbarStyle } from "./editorShellTheme";

export interface PostEditorShellProps extends EditorChromeSharedProps {
  draftContentType?: LinkedInDraftContentType;
  previewMode: LinkedInPreviewMode;
  onPreviewModeChange: (mode: LinkedInPreviewMode) => void;
  getDraftForPublish?: () => string;
  onInsertImageIntoDraft?: (imageUrl: string) => void;
  topic?: string;
}

export const PostEditorShell: React.FC<PostEditorShellProps> = ({
  draft,
  draftContentType,
  previewMode,
  onPreviewModeChange,
  getDraftForPublish,
  onInsertImageIntoDraft,
  topic,
  ...sharedProps
}) => {
  return (
    <ThemeProvider theme={editorShellTheme}>
      <div
        data-testid="post-editor-shell"
        style={editorShellToolbarStyle}
      >
        <EditorChromeShared draft={draft} {...sharedProps} />

        <EditorPreviewModeToggle
          previewMode={previewMode}
          onPreviewModeChange={onPreviewModeChange}
          testId="post-preview-mode-toggle"
        />

        <PublishLinkedInPanel
          draft={draft}
          draftContentType={draftContentType}
          getDraftForPublish={getDraftForPublish}
          onInsertImageIntoDraft={onInsertImageIntoDraft}
          topic={topic}
          compact
        />
      </div>
    </ThemeProvider>
  );
};
