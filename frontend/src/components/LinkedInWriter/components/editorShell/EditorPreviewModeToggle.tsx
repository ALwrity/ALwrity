/**
 * Shared LinkedIn / Citations preview toggle for post and article editor shells.
 */

import React from "react";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import type { LinkedInPreviewMode } from "../LinkedInPreviewModeToggle";

export interface EditorPreviewModeToggleProps {
  previewMode: LinkedInPreviewMode;
  onPreviewModeChange: (mode: LinkedInPreviewMode) => void;
  testId?: string;
}

export const EditorPreviewModeToggle: React.FC<EditorPreviewModeToggleProps> = ({
  previewMode,
  onPreviewModeChange,
  testId = "editor-preview-mode-toggle",
}) => (
  <ToggleButtonGroup
    size="small"
    exclusive
    value={previewMode}
    onChange={(_, next) => {
      if (next) onPreviewModeChange(next);
    }}
    aria-label="Preview mode"
    data-testid={testId}
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
          previewMode === "linkedin" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
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
          previewMode === "studio" ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
        "&:hover": {
          bgcolor: previewMode === "studio" ? "#fff" : "#e2e8f0",
        },
      }}
    >
      Citations
    </ToggleButton>
  </ToggleButtonGroup>
);
