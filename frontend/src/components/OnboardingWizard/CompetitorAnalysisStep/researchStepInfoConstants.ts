import type { SxProps, Theme } from '@mui/material';

export const RESEARCH_SECTION_HEADING_COLOR = '#1a202c';

/** Tooltip and aria-label for the info control */
export const RESEARCH_INFO_MODAL_TITLE = 'What ALwrity does?';

/** Visible title inside the info panel / modal */
export const RESEARCH_INFO_PANEL_TITLE = 'What ALwrity does? ALwrity is mapping your Market';

/** Grey gradient styling for the research info panel title. */
export const researchInfoPanelTitleSx: SxProps<Theme> = {
  fontWeight: 700,
  background: 'linear-gradient(135deg, #64748b 0%, #94a3b8 45%, #475569 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
};
