/**
 * Multiline editor for the active article section body.
 */

import React, { forwardRef } from "react";
import { Box, TextField, Typography } from "@mui/material";
import { articleBodyInputSx } from "./articleEditorStyles";

export interface ArticleSectionBodyEditorProps {
  heading: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  isIntroduction?: boolean;
}

export const ArticleSectionBodyEditor = forwardRef<
  HTMLTextAreaElement,
  ArticleSectionBodyEditorProps
>(function ArticleSectionBodyEditor(
  { heading, value, onChange, disabled = false, isIntroduction = false },
  ref,
) {
  const displayHeading = isIntroduction
    ? "Hook your readers"
    : heading.trim() || "Untitled section";

  return (
    <Box
      data-testid="article-section-body-editor"
      data-section-kind={isIntroduction ? "introduction" : "section"}
    >
      <Typography
        variant="overline"
        sx={{
          display: "block",
          color: "#64748b",
          letterSpacing: 0.8,
          mb: 0.5,
        }}
      >
        {isIntroduction ? "Introduction" : "Section content"}
      </Typography>
      <Typography
        component="h3"
        sx={{
          fontWeight: 700,
          fontSize: 20,
          color: "#1e293b",
          mb: 0.5,
          lineHeight: 1.3,
        }}
      >
        {displayHeading}
      </Typography>
      {isIntroduction ? (
        <Typography
          variant="caption"
          sx={{ color: "#64748b", display: "block", mb: 1.5, lineHeight: 1.4 }}
        >
          Your opening paragraph appears before the first section heading in the
          published article.
        </Typography>
      ) : null}
      <TextField
        fullWidth
        multiline
        minRows={isIntroduction ? 6 : 10}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={
          isIntroduction
            ? "Write your opening paragraph here — set context and draw readers in."
            : "Write this section's paragraphs here. Use the toolbar above for bold, lists, and links."
        }
        inputRef={ref}
        sx={articleBodyInputSx}
      />
    </Box>
  );
});
