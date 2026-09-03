/**
 * Shared styles for YouTube Creator Studio
 * Enterprise-quality styling with improved contrast and readability
 */

import { YT_RED, YT_TEXT } from './constants';

// Enhanced color palette for better contrast
const BORDER_COLOR = '#d1d5db'; // Lighter gray for better contrast
const BORDER_HOVER = '#9ca3af'; // Medium gray on hover
const BORDER_FOCUS = YT_RED;
const TEXT_PRIMARY = '#111827'; // Darker for better readability
const TEXT_SECONDARY = '#6b7280'; // Medium gray for secondary text
const TEXT_PLACEHOLDER = '#9ca3af'; // Lighter gray for placeholders
const BACKGROUND = '#ffffff';
const BACKGROUND_HOVER = '#f9fafb';

export {
  BACKGROUND,
  BACKGROUND_HOVER,
  BORDER_COLOR,
  BORDER_HOVER,
  TEXT_PRIMARY,
};

export const inputSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: BACKGROUND,
    color: TEXT_PRIMARY,
    borderRadius: 1.5,
    fontSize: '0.9375rem', // 15px for better readability
    transition: 'all 0.2s ease-in-out',
    '& fieldset': {
      borderColor: BORDER_COLOR,
      borderWidth: '1.5px',
    },
    '&:hover fieldset': {
      borderColor: BORDER_HOVER,
    },
    '&.Mui-focused fieldset': {
      borderColor: BORDER_FOCUS,
      borderWidth: '2px',
      boxShadow: `0 0 0 3px rgba(255, 0, 0, 0.1)`,
    },
    '& input::placeholder, & textarea::placeholder': {
      color: TEXT_PLACEHOLDER,
      opacity: 1,
      fontSize: '0.9375rem',
    },
    '&.Mui-disabled': {
      backgroundColor: BACKGROUND_HOVER,
      '& fieldset': {
        borderColor: BORDER_COLOR,
      },
    },
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.875rem',
    fontWeight: 500,
  },
};

export const selectSx = {
  backgroundColor: BACKGROUND,
  borderRadius: 1.5,
  fontSize: '0.9375rem',
  transition: 'all 0.2s ease-in-out',
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: BORDER_COLOR,
    borderWidth: '1.5px',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: BORDER_HOVER,
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    borderColor: BORDER_FOCUS,
    borderWidth: '2px',
    boxShadow: `0 0 0 3px rgba(255, 0, 0, 0.1)`,
  },
  '& .MuiSelect-select': {
    color: TEXT_PRIMARY,
    backgroundColor: BACKGROUND,
    padding: '14px 14px',
    fontSize: '0.9375rem',
    fontWeight: 400,
  },
  '& .MuiSvgIcon-root': {
    color: TEXT_SECONDARY,
    fontSize: '1.5rem',
  },
  '&.Mui-disabled': {
    backgroundColor: BACKGROUND_HOVER,
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: BORDER_COLOR,
    },
  },
};

// Menu props for Select dropdown. Stacking is MUI-native (Phase 3).
export const selectMenuProps = {
  PaperProps: {
    sx: {
      backgroundColor: BACKGROUND,
      color: TEXT_PRIMARY,
      borderRadius: 2,
      border: `1px solid ${BORDER_COLOR}`,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      mt: 0.5,
      maxHeight: 400,
      '& .MuiMenuItem-root': {
        color: TEXT_PRIMARY,
        backgroundColor: BACKGROUND,
        fontSize: '0.9375rem',
        padding: '10px 16px',
        '&:hover': {
          backgroundColor: BACKGROUND_HOVER,
        },
        '&.Mui-selected': {
          backgroundColor: '#f3f4f6',
          color: TEXT_PRIMARY,
          '&:hover': {
            backgroundColor: '#e5e7eb',
          },
        },
        '&.Mui-focusVisible': {
          backgroundColor: BACKGROUND_HOVER,
        },
      },
    },
  },
  MenuListProps: {
    sx: {
      padding: 0,
      '& .MuiMenuItem-root': {
        color: TEXT_PRIMARY,
        '& em': {
          color: TEXT_SECONDARY,
          fontStyle: 'normal',
        },
      },
    },
  },
};

export const labelSx = {
  color: TEXT_PRIMARY,
  fontSize: '0.875rem',
  fontWeight: 600,
  marginBottom: '4px',
  '&.Mui-focused': {
    color: BORDER_FOCUS,
  },
  '&.Mui-required': {
    '&::after': {
      content: '" *"',
      color: BORDER_FOCUS,
    },
  },
};

export const helperSx = {
  color: TEXT_SECONDARY,
  fontSize: '0.8125rem', // 13px
  marginTop: '6px',
  lineHeight: 1.5,
  fontWeight: 400,
};

/** Outlined surface matching Privacy/select: light border that darkens on hover. */
export const outlinedControlSx = {
  backgroundColor: BACKGROUND,
  border: `1.5px solid ${BORDER_COLOR}`,
  borderRadius: 1.5,
  transition: 'border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
  '&:hover': {
    borderColor: BORDER_HOVER,
  },
  '&:focus-within': {
    borderColor: BORDER_FOCUS,
    boxShadow: `0 0 0 3px rgba(255, 0, 0, 0.1)`,
  },
};

export const readableChipSx = {
  backgroundColor: BACKGROUND,
  color: TEXT_PRIMARY,
  border: `1.5px solid ${BORDER_COLOR}`,
  fontWeight: 500,
  '& .MuiChip-label': {
    color: TEXT_PRIMARY,
  },
  '& .MuiChip-deleteIcon': {
    color: TEXT_SECONDARY,
  },
};

// Additional styles for better UI
export const paperSx = {
  backgroundColor: BACKGROUND,
  border: `1.5px solid ${BORDER_COLOR}`,
  borderRadius: 2,
  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
};

export const sectionTitleSx = {
  fontSize: '1.25rem',
  fontWeight: 600,
  color: TEXT_PRIMARY,
  marginBottom: 2,
  lineHeight: 1.4,
};

/** Tooltip Popper — MUI default z-index (1500). No Studio +1 patch. */
export const tooltipPopperProps = {};

export const tooltipSx = {
  '& .MuiTooltip-tooltip': {
    backgroundColor: TEXT_PRIMARY,
    color: BACKGROUND,
    fontSize: '0.8125rem',
    padding: '8px 12px',
    borderRadius: 1,
    maxWidth: 300,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  '& .MuiTooltip-arrow': {
    color: TEXT_PRIMARY,
  },
};

