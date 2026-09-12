import React from 'react';
import { Box, Typography } from '@mui/material';
import { ResearchStepBackgroundSetupContent } from './ResearchStepBackgroundSetupContent';
import { BACKGROUND_SETUP_SEO_DASHBOARD_NOTE } from './researchStepBackgroundSetupConstants';
import type { BackgroundSetupContentState } from './ResearchStepBackgroundSetupContent';

interface ResearchStepBackgroundSetupPanelProps {
  active: boolean;
  setup: BackgroundSetupContentState;
}

export const ResearchStepBackgroundSetupPanel: React.FC<ResearchStepBackgroundSetupPanelProps> = ({
  active,
  setup,
}) => {
  if (!active) {
    return null;
  }

  const { taskHealth } = setup;

  return (
    <Box data-testid="research-background-setup-panel">
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2.5,
          borderBottom: '1px solid #e2e8f0',
          bgcolor: '#f8fafc',
        }}
      >
        {taskHealth?.last_updated && (
          <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
            Last updated: {new Date(taskHealth.last_updated).toLocaleString()}
          </Typography>
        )}
        <Typography variant="body2" sx={{ color: '#64748b', mt: taskHealth?.last_updated ? 0.5 : 0 }}>
          {BACKGROUND_SETUP_SEO_DASHBOARD_NOTE}
        </Typography>
      </Box>
      <ResearchStepBackgroundSetupContent {...setup} />
    </Box>
  );
};
