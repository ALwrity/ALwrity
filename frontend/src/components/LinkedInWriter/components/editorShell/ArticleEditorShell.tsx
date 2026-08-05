/**
 * Article editor chrome — placeholder shell until structured layout (PR6).
 */

import React from "react";
import { Alert, Chip, ThemeProvider } from "@mui/material";
import {
  EditorChromeShared,
  type EditorChromeSharedProps,
} from "./EditorChromeShared";
import { editorShellTheme, editorShellToolbarStyle } from "./editorShellTheme";

export type ArticleEditorShellProps = EditorChromeSharedProps;

export const ArticleEditorShell: React.FC<ArticleEditorShellProps> = ({
  draft,
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
        </div>

        <Alert
          severity="info"
          data-testid="article-editor-placeholder"
          sx={{
            mx: 2,
            mt: 1.5,
            mb: 0,
            borderRadius: 2,
            fontSize: 13,
          }}
        >
          Article layout (title, cover, sections) coming soon — edit your draft
          below. LinkedIn article publishing is not yet supported from ALwrity;
          finish in LinkedIn&apos;s native editor when ready.
        </Alert>
      </div>
    </ThemeProvider>
  );
};
