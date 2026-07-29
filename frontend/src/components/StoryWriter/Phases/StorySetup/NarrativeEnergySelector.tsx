import React from 'react';
import { Typography, Box, Tooltip } from '@mui/material';

interface EnergyOption {
  value: string;
  label: string;
  description: string;
  example: string;
}

interface NarrativeEnergySelectorProps {
  options: EnergyOption[];
  value: string;
  onChange: (value: string) => void;
}

const tooltipSx = {
  '& .MuiTooltip-tooltip': {
    bgcolor: '#F7F3E9',
    borderRadius: 2,
    p: 1.5,
    maxWidth: 300,
    boxShadow: '0 8px 24px rgba(44,36,22,0.18)',
    border: '1px solid rgba(141,110,99,0.25)',
  },
  '& .MuiTooltip-arrow': {
    color: '#F7F3E9',
    '&::before': {
      border: '1px solid rgba(141,110,99,0.25)',
    },
  },
};

export const NarrativeEnergySelector: React.FC<NarrativeEnergySelectorProps> = ({
  options,
  value,
  onChange,
}) => {
  return (
    <Box sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(148,163,184,0.4)', bgcolor: '#ffffff' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
        Narrative Energy
      </Typography>
      <Typography variant="body2" sx={{ mb: 1.5, color: '#4b5563', fontSize: '0.8rem' }}>
        Set the pacing and intensity of your storytelling.
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {options.map((opt) => (
          <Tooltip
            key={opt.value}
            title={
              <Box sx={{ maxWidth: 260 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5, color: '#2C2416', fontSize: '0.8rem' }}>
                  {opt.label}
                </Typography>
                <Typography variant="body2" sx={{ mb: 0.5, color: '#5D4037', fontSize: '0.75rem' }}>
                  {opt.description}
                </Typography>
                <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#8D6E63', fontSize: '0.7rem' }}>
                  Example: {opt.example}
                </Typography>
              </Box>
            }
            arrow
            placement="top"
            slotProps={{ popper: { sx: tooltipSx } }}
          >
            <Box
              onClick={() => onChange(opt.value)}
              sx={{
                px: 1.5,
                py: 0.6,
                borderRadius: 999,
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 500,
                border: '1.5px solid',
                borderColor: value === opt.value ? '#6366f1' : 'rgba(148,163,184,0.5)',
                bgcolor: value === opt.value ? 'rgba(99,102,241,0.1)' : '#ffffff',
                color: value === opt.value ? '#4338ca' : '#374151',
                transition: 'all 0.15s ease',
                '&:hover': {
                  borderColor: '#6366f1',
                  bgcolor: 'rgba(99,102,241,0.06)',
                },
              }}
            >
              {opt.label}
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
};
