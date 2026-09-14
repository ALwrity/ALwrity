import type { SxProps, Theme } from '@mui/material';

/** Shared IconButton styling for section info icons across onboarding steps. */
export const sectionInfoIconButtonSx: SxProps<Theme> = {
  color: 'text.secondary',
  opacity: 0.7,
  p: 0.25,
  '&:hover': {
    opacity: 1,
    color: 'primary.main',
    bgcolor: 'rgba(0,0,0,0.04)',
  },
};

export const sectionInfoTooltipSx: SxProps<Theme> = {
  bgcolor: 'rgba(30, 41, 59, 0.95)',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  maxWidth: 300,
  p: 1.5,
  borderRadius: 2,
};

export const sectionInfoTooltipArrowSx: SxProps<Theme> = {
  color: 'rgba(30, 41, 59, 0.95)',
};
