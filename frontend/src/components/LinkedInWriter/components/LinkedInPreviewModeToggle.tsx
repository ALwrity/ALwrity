/**
 * Citations vs LinkedIn-style preview toggle.
 * Default = Citations view (research sources and citation markers visible).
 * LinkedIn-style = plain text with Best Practices spacing, no citations.
 *
 * Linkedin view for end user to see what they post.
 * Citations view for power users to audit and edit research-backed content.
 */

import React from "react";
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { LinkedInDraftPreview } from "./LinkedInDraftPreview";
import { LinkedInPublishPreviewPlain } from "./LinkedInPublishPreviewPlain";

export type LinkedInPreviewMode = "studio" | "linkedin";

interface LinkedInPreviewModeToggleProps {
  draft: string;
  citations?: any[];
  researchSources?: any[];
  mode: LinkedInPreviewMode;
  onModeChange: (mode: LinkedInPreviewMode) => void;
}

export const LinkedInPreviewModeToggle: React.FC<
  LinkedInPreviewModeToggleProps
> = ({ draft, citations, researchSources, mode, onModeChange }) => {
  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          flexWrap: "wrap",
          mb: 1.5,
        }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={mode}
          onChange={(_, next: LinkedInPreviewMode | null) => {
            if (next) onModeChange(next);
          }}
          aria-label="Preview mode"
        >
          <ToggleButton
            value="linkedin"
            sx={{ textTransform: "none", px: 1.5, fontSize: 12 }}
          >
            LinkedIn-style
          </ToggleButton>
          <ToggleButton
            value="studio"
            sx={{ textTransform: "none", px: 1.5, fontSize: 12 }}
          >
            Citations
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" sx={{ color: "#64748b", maxWidth: 300 }}>
          {mode === "linkedin"
            ? "How the post reads on LinkedIn — plain text, line breaks, no citation badges."
            : "Research view — shows cited sources and reference markers inline."}
        </Typography>
      </Box>

      {mode === "studio" ? (
        <LinkedInDraftPreview
          draft={draft}
          citations={citations}
          researchSources={researchSources}
        />
      ) : (
        <LinkedInPublishPreviewPlain
          draft={draft}
          title="LinkedIn-style preview"
        />
      )}
    </Box>
  );
};
