import type { SxProps, Theme } from '@mui/material';

/** Shared one-line section description under h6 titles (Discovered Competitors, Content Pillars, etc.). */
export const researchSectionDescriptionSx: SxProps<Theme> = {
  color: '#64748b',
  mt: 0.5,
  pl: { xs: 0, sm: 4 },
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
