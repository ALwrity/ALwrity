/**
 * Studio vs LinkedIn-style preview toggle.
 * Default = Studio (markdown + citations). LinkedIn-style = plain publish preview.
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
          <ToggleButton value="studio" sx={{ textTransform: 'none', px: 1.5, fontSize: 12 }}>
            Studio preview
          </ToggleButton>
          <ToggleButton value="linkedin" sx={{ textTransform: 'none', px: 1.5, fontSize: 12 }}>
            LinkedIn-style (plain)
          </ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" sx={{ color: '#64748b', maxWidth: 280 }}>
          {mode === 'studio'
            ? 'Studio shows draft formatting and citations.'
            : 'Plain text as LinkedIn typically displays posts.'}
        </Typography>
      </Box>

      {mode === 'studio' ? (
        <LinkedInDraftPreview
          draft={draft}
          citations={citations}
          researchSources={researchSources}
        />
      ) : (
        <LinkedInPublishPreviewPlain draft={draft} />
      )}
    </Box>
  );
};
