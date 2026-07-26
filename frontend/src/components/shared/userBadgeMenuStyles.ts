import type { SxProps, Theme } from '@mui/material';

/** LinkedIn Studio navigation bar blue — used for menu row hover. */
export const userBadgeNavBarBlue = '#bce0fd';
export const userBadgeNavBarAccent = '#0a66c2';

/** Uppercase section label — matches System Health / Usage Statistics. */
export const userBadgeSectionLabelSx = {
  display: 'block',
  mb: 0.5,
  fontWeight: 600,
  color: '#6b7280',
  fontSize: '0.65rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
} as const;

/** Header-only menu row label — section titles (Manage Subscription size). */
export const userBadgeSectionHeaderOnlyLabelSx = {
  ...userBadgeSectionLabelSx,
  mb: 0,
  fontSize: 'calc(0.65rem + 2px)',
} as const;

/** Display name — same font size as Manage Subscription (title case for user name). */
export const userBadgeMenuNameSx = {
  fontSize: 'calc(0.65rem + 2px)',
  fontWeight: 600,
  color: '#1a1a2e',
  letterSpacing: '0.5px',
  lineHeight: 1.15,
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

export const userBadgeMenuEmailSx = {
  color: '#6b7280',
  fontSize: 'calc(0.55rem + 1px)',
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
} as const;

/** Grey user identity header (−10% section height). */
export const userBadgeMenuIdentitySx = {
  px: 2,
  pt: 0.73,
  pb: 0.6,
  bgcolor: '#f8f9fb',
  borderBottom: '1px solid rgba(0,0,0,0.06)',
} as const;

/** Header-only nav rows — +5% vertical padding vs prior py: 1. */
export const userBadgeSectionHeaderOnlyPy = 1.05;

/** Menu paper width (+5% vs prior 254 / 315px). */
export const USER_BADGE_MENU_MIN_WIDTH = 267;
export const USER_BADGE_MENU_MAX_WIDTH = 331;

/** Popover shell — fixed width, no scroll (inner .user-badge-menu-scroll scrolls). */
export const userBadgeMenuPaperSx: SxProps<Theme> = {
  minWidth: USER_BADGE_MENU_MIN_WIDTH,
  maxWidth: USER_BADGE_MENU_MAX_WIDTH,
  width: USER_BADGE_MENU_MAX_WIDTH,
  maxHeight: '85vh',
  overflow: 'hidden',
  boxSizing: 'border-box',
  bgcolor: '#ffffff',
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 3,
  boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)',
};

/** Clickable nav-menu section row (not a gradient button). */
export const userBadgeSectionRowSx: SxProps<Theme> = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  px: 2.5,
  py: 1.25,
  border: 'none',
  borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
  bgcolor: '#ffffff',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'background 0.15s ease, color 0.15s ease',
  '&:hover:not(:disabled)': {
    bgcolor: userBadgeNavBarBlue,
    '& .MuiTypography-root': {
      color: userBadgeNavBarAccent,
    },
    '& .MuiSvgIcon-root': {
      color: userBadgeNavBarAccent,
    },
  },
};

export const userBadgeSectionTitleSx = {
  fontSize: '0.85rem',
  fontWeight: 700,
  color: '#1a1a2e',
  lineHeight: 1.35,
} as const;

export const userBadgeSectionHintSx = {
  display: 'block',
  mt: 0.35,
  fontSize: '0.72rem',
  color: '#6b7280',
  lineHeight: 1.4,
} as const;
