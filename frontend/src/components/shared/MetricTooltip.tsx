import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

interface MetricTooltipProps {
  title: string;
  dark?: boolean;
}

/**
 * Reusable tooltip that explains a metric in plain language.
 * `dark` renders light-on-dark for dashboard (GlassCard) surfaces.
 */
const MetricTooltip: React.FC<MetricTooltipProps> = ({ title, dark = false }) => (
  <Tooltip
    title={
      <Box sx={{ p: 0.75 }}>
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 600, mb: 0.5, color: '#fff' }}
        >
          What does this mean?
        </Typography>
        <Typography variant="body2" sx={{ color: '#f0f0f0', lineHeight: 1.5 }}>
          {title}
        </Typography>
      </Box>
    }
    arrow
    placement="top"
    componentsProps={{
      tooltip: {
        sx: {
          bgcolor: 'rgba(30, 41, 59, 0.95)',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          maxWidth: 320,
          p: 1,
          borderRadius: 2,
        },
      },
      arrow: { sx: { color: 'rgba(30, 41, 59, 0.95)' } },
    }}
  >
    <InfoIcon
      sx={{
        fontSize: 15,
        cursor: 'help',
        verticalAlign: 'middle',
        color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)',
        '&:hover': { color: dark ? 'rgba(255,255,255,0.9)' : 'primary.main' },
      }}
    />
  </Tooltip>
);

export default MetricTooltip;
