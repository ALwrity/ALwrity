/**
 * Studio vs LinkedIn-style preview toggle.
 * Default = LinkedIn-style (plain, Best Practices spacing, no citation chips).
 * Studio keeps research citations for power users.
 */

import React from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { LinkedInDraftPreview } from './LinkedInDraftPreview';
import { LinkedInPublishPreviewPlain } from './LinkedInPublishPreviewPlain';

export type LinkedInPreviewMode = 'studio' | 'linkedin';

interface LinkedInPreviewModeToggleProps {
  draft: string;
  citations?: any[];
  researchSources?: any[];
  mode: LinkedInPreviewMode;
  onModeChange: (mode: LinkedInPreviewMode) => void;
}

export const LinkedInPreviewModeToggle: React.FC<LinkedInPreviewModeToggleProps> = ({
  draft,
  citations,
  researchSources,
  mode,
  onModeChange,
}) => {
  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
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
          <ToggleButton value="linkedin" sx={{ textTransform: 'none', px: 1.5, fontSize: 12 }}>
            LinkedIn-style
          </ToggleButton>
          <ToggleButton value="studio" sx={{ textTransform: 'none', px: 1.5, fontSize: 12 }}>
            Studio (citations)
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" sx={{ color: '#64748b', maxWidth: 300 }}>
          {mode === 'linkedin'
            ? 'How the post reads on LinkedIn — plain text, line breaks, no citation chips.'
            : 'Studio view keeps research citation markers for editing.'}
        </Typography>
      </Box>

      {mode === 'studio' ? (
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
