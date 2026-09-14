import React from 'react';
import { Box, Grid, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AutoFixHighIcon from '@mui/icons-material/AutoAwesome';
import { RESEARCH_INFO_PANEL_TITLE, researchInfoPanelTitleSx } from './researchStepInfoConstants';
import { ResearchStepInfoPillar } from './ResearchStepInfoPillar';

const RESEARCH_INFO_PILLARS = [
  {
    label: 'What',
    description: 'We analyze top competitors in your niche.',
    Icon: SearchIcon,
    iconBg: '#DBEAFE',
    iconColor: '#2563EB',
  },
  {
    label: 'Why',
    description: 'To identify content gaps and market positioning.',
    Icon: TrendingUpIcon,
    iconBg: '#F3E8FF',
    iconColor: '#7C3AED',
  },
  {
    label: 'How',
    description: 'Using AI to scan their public content and social footprint.',
    Icon: AutoFixHighIcon,
    iconBg: '#DCFCE7',
    iconColor: '#16A34A',
  },
] as const;

interface ResearchStepInfoPanelProps {
  showTitle?: boolean;
  onClose?: () => void;
}

export const ResearchStepInfoPanel: React.FC<ResearchStepInfoPanelProps> = ({
  showTitle = true,
  onClose,
}) => (
  <Box
    data-testid="research-step-info-panel"
    sx={{
      position: 'relative',
      mb: 3,
      mt: 1.5,
      p: { xs: 2, md: 3 },
      pt: onClose ? { xs: 2.5, md: 3.5 } : { xs: 2, md: 3 },
      bgcolor: '#ffffff',
      borderRadius: 3,
      border: '1px solid #E5E7EB',
      boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
      textAlign: 'center',
    }}
  >
    {onClose && (
      <IconButton
        size="small"
        onClick={onClose}
        aria-label="Close research information panel"
        data-testid="research-step-info-panel-close"
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          color: '#64748b',
          bgcolor: '#f8fafc',
          border: '1px solid #e2e8f0',
          '&:hover': { bgcolor: '#f1f5f9', color: '#334155' },
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    )}

    {showTitle && (
      <Typography
        variant="h6"
        component="h2"
        fontWeight={700}
        sx={{ ...researchInfoPanelTitleSx, mb: 2.5, textAlign: 'center', pr: onClose ? 3 : 0 }}
      >
        {RESEARCH_INFO_PANEL_TITLE}
      </Typography>
    )}

    <Grid container spacing={{ xs: 2.5, md: 3 }}>
      {RESEARCH_INFO_PILLARS.map((pillar) => (
        <Grid item xs={12} md={4} key={pillar.label}>
          <ResearchStepInfoPillar {...pillar} />
        </Grid>
      ))}
    </Grid>
  </Box>
);
