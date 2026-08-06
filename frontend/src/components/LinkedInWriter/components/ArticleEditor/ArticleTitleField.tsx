/**
 * Large LinkedIn-style article title field.
 */

import React from "react";
import { Box, TextField, Typography } from "@mui/material";
import { articleTitleInputSx } from "./articleEditorStyles";

export interface ArticleTitleFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const ArticleTitleField: React.FC<ArticleTitleFieldProps> = ({
  value,
  onChange,
  disabled = false,
}) => (
  <Box>
    <Typography
      variant="overline"
      sx={{ display: "block", color: "#64748b", letterSpacing: 0.8, mb: 0.5 }}
    >
      Article title
    </Typography>
    <TextField
      fullWidth
      multiline
      minRows={1}
      maxRows={4}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Enter your article headline"
      inputProps={{ "data-testid": "article-title-field" }}
      sx={articleTitleInputSx}
    />
  </Box>
);
