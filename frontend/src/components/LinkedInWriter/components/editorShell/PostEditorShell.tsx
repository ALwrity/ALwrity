/**
 * Post editor chrome — feed preview toggle and publish controls.
 */

import React from "react";
import { ThemeProvider } from "@mui/material/styles";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import PublishLinkedInPanel from "../PublishLinkedInPanel";
import type { LinkedInDraftContentType } from "../../utils/linkedInDraftLibraryUtils";
import type { LinkedInPreviewMode } from "../LinkedInPreviewModeToggle";
import {
  EditorChromeShared,
  type EditorChromeSharedProps,
} from "./EditorChromeShared";
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

        <ToggleButtonGroup
          size="small"
          exclusive
          value={previewMode}
          onChange={(_, next) => {
            if (next) onPreviewModeChange(next);
          }}
          aria-label="Preview mode"
          data-testid="post-preview-mode-toggle"
          sx={{
            bgcolor: "#f1f5f9",
            borderRadius: 2,
            p: 0.3,
            gap: 0.3,
            "& .MuiToggleButtonGroup-grouped": {
              border: "none",
              borderRadius: 1.5,
              mx: 0,
            },
          }}
        >
          <ToggleButton
            value="linkedin"
            sx={{
              textTransform: "none",
              px: 1.8,
              py: 0.4,
              fontSize: 12,
              fontWeight: 600,
              color: previewMode === "linkedin" ? "#0a66c2" : "#64748b",
              bgcolor: previewMode === "linkedin" ? "#fff" : "transparent",
              boxShadow:
                previewMode === "linkedin"
                  ? "0 1px 3px rgba(0,0,0,0.12)"
                  : "none",
              "&:hover": {
                bgcolor: previewMode === "linkedin" ? "#fff" : "#e2e8f0",
              },
            }}
          >
            LinkedIn
          </ToggleButton>
          <ToggleButton
            value="studio"
            sx={{
              textTransform: "none",
              px: 1.8,
              py: 0.4,
              fontSize: 12,
              fontWeight: 600,
              color: previewMode === "studio" ? "#6366f1" : "#64748b",
              bgcolor: previewMode === "studio" ? "#fff" : "transparent",
              boxShadow:
                previewMode === "studio"
                  ? "0 1px 3px rgba(0,0,0,0.12)"
                  : "none",
              "&:hover": {
                bgcolor: previewMode === "studio" ? "#fff" : "#e2e8f0",
              },
            }}
          >
            Citations
          </ToggleButton>
        </ToggleButtonGroup>

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
