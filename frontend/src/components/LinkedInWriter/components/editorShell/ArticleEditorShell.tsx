/**
 * Article editor chrome — structured layout toolbar (PR6).
 */

import React from "react";
import { Chip, ThemeProvider } from "@mui/material";
import PublishLinkedInPanel from "../PublishLinkedInPanel";
import type { LinkedInDraftContentType } from "../../utils/linkedInDraftLibraryUtils";
import {
  EditorChromeShared,
  type EditorChromeSharedProps,
} from "./EditorChromeShared";
import { editorShellTheme, editorShellToolbarStyle } from "./editorShellTheme";

export interface ArticleEditorShellProps extends EditorChromeSharedProps {
  draftContentType?: LinkedInDraftContentType;
  getDraftForPublish?: () => string;
  onInsertImageIntoDraft?: (imageUrl: string) => void;
  topic?: string;
}

export const ArticleEditorShell: React.FC<ArticleEditorShellProps> = ({
  draft,
  draftContentType = "article",
  getDraftForPublish,
  onInsertImageIntoDraft,
  topic,
  ...sharedProps
}) => {
  return (
    <ThemeProvider theme={editorShellTheme}>
      <div data-testid="article-editor-shell">
        <div style={editorShellToolbarStyle}>
          <EditorChromeShared draft={draft} {...sharedProps} />

          <Chip
            label="Article"
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: 11,
              bgcolor: "#ecfdf5",
              color: "#047857",
              border: "1px solid #6ee7b7",
            }}
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
      </div>
    </ThemeProvider>
  );
};
