import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AutoFixHighIcon from '@mui/icons-material/AutoAwesome';
import { RESEARCH_INFO_PANEL_TITLE, RESEARCH_SECTION_HEADING_COLOR } from './researchStepInfoConstants';

const pillarLabelSx = {
  fontWeight: 700,
  color: RESEARCH_SECTION_HEADING_COLOR,
};

interface ResearchStepInfoPanelProps {
  showTitle?: boolean;
}

export const ResearchStepInfoPanel: React.FC<ResearchStepInfoPanelProps> = ({ showTitle = true }) => (
  <Box
    data-testid="research-step-info-panel"
    sx={{
      mb: 3,
      p: 3,
      bgcolor: '#ffffff',
      borderRadius: 3,
      border: '1px solid #E5E7EB',
      boxShadow: '0 1px 2px rgba(16,24,40,0.06)',
      textAlign: 'center',
    }}
  >
    {showTitle && (
      <Typography
        variant="h6"
        component="h2"
        fontWeight={700}
        sx={{ color: RESEARCH_SECTION_HEADING_COLOR, mb: 2.5, textAlign: 'center' }}
      >
        {RESEARCH_INFO_PANEL_TITLE}
      </Typography>
    )}
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Box sx={{ p: 1.5, bgcolor: '#DBEAFE', borderRadius: '50%', mb: 1.5, color: '#2563EB' }}>
            <SearchIcon />
          </Box>
          <Typography variant="subtitle2" sx={pillarLabelSx} gutterBottom>What</Typography>
          <Typography variant="body2" color="text.secondary">
            We analyze top competitors in your niche.
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={12} md={4}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Box sx={{ p: 1.5, bgcolor: '#F3E8FF', borderRadius: '50%', mb: 1.5, color: '#7C3AED' }}>
            <TrendingUpIcon />
          </Box>
          <Typography variant="subtitle2" sx={pillarLabelSx} gutterBottom>Why</Typography>
          <Typography variant="body2" color="text.secondary">
            To identify content gaps and market positioning.
          </Typography>
        </Box>
      </Grid>
      <Grid item xs={12} md={4}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <Box sx={{ p: 1.5, bgcolor: '#DCFCE7', borderRadius: '50%', mb: 1.5, color: '#16A34A' }}>
            <AutoFixHighIcon />
          </Box>
          <Typography variant="subtitle2" sx={pillarLabelSx} gutterBottom>How</Typography>
          <Typography variant="body2" color="text.secondary">
            Using AI to scan their public content and social footprint.
          </Typography>
        </Box>
      </Grid>
    </Grid>
  </Box>
);
