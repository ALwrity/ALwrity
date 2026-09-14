import type { SxProps, Theme } from '@mui/material';

/** Matches Discovered Competitors (10) h6 in the unified dashboard. */
export const researchSectionHeadingSx: SxProps<Theme> = {
  fontWeight: 600,
  color: '#1a202c !important',
};

/** Extra spacing between the wizard progress bar and Research step hero. */
export const RESEARCH_STEP_HEADER_TOP_MARGIN = { xs: 0.5, md: 1 } as const;

/** Space between Research hero block and Social Media Presence row. */
export const RESEARCH_STEP_HEADER_BOTTOM_MARGIN = 2.5;

/** Shared one-line section description under h6 titles (Discovered Competitors, Content Pillars, etc.). */
export const researchSectionDescriptionSx: SxProps<Theme> = {
  color: '#64748b',
  mt: 0.5,
  pl: { xs: 0, sm: 4 },
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};
