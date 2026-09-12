import React from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';

interface ResearchStepBackgroundSetupPanelProps {
  onOpenBackgroundSetup: () => void;
}

export const ResearchStepBackgroundSetupPanel: React.FC<ResearchStepBackgroundSetupPanelProps> = ({
  onOpenBackgroundSetup,
}) => (
  <Box data-testid="research-background-setup-panel" sx={{ p: { xs: 2, md: 3 } }}>
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 2,
        border: '1px solid #E2E8F0',
        bgcolor: '#F8FAFC',
        textAlign: 'center',
      }}
    >
      <SettingsIcon sx={{ fontSize: 40, color: '#3B82F6', mb: 1.5 }} />
      <Typography variant="h6" fontWeight={700} sx={{ color: '#1E293B', mb: 1 }}>
        Smart Background Setup
      </Typography>
      <Typography variant="body2" sx={{ color: '#64748B', mb: 2.5, maxWidth: 480, mx: 'auto' }}>
        Enable and run scheduled tasks — deep competitor analysis, site indexing, and market trends —
        while you finish onboarding.
      </Typography>
      <Button
        variant="contained"
        onClick={onOpenBackgroundSetup}
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          bgcolor: '#3B82F6',
          '&:hover': { bgcolor: '#2563EB' },
        }}
      >
        Open Smart Background Setup
      </Button>
    </Paper>
  </Box>
);
