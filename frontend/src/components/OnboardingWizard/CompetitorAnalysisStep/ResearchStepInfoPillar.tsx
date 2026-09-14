import React from 'react';
import { Box, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import { RESEARCH_SECTION_HEADING_COLOR } from './researchStepInfoConstants';

export interface ResearchStepInfoPillarProps {
  label: string;
  description: string;
  Icon: SvgIconComponent;
  iconBg: string;
  iconColor: string;
}

export const ResearchStepInfoPillar: React.FC<ResearchStepInfoPillarProps> = ({
  label,
  description,
  Icon,
  iconBg,
  iconColor,
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      px: { xs: 0.5, md: 1 },
    }}
  >
    <Box
      sx={{
        width: 52,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        bgcolor: iconBg,
        color: iconColor,
        mb: 1.5,
        boxShadow: '0 4px 14px rgba(15, 23, 42, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.8)',
      }}
    >
      <Icon sx={{ fontSize: 26 }} />
    </Box>
    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: RESEARCH_SECTION_HEADING_COLOR, mb: 0.5 }}>
      {label}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5, maxWidth: 220 }}>
      {description}
    </Typography>
  </Box>
);
