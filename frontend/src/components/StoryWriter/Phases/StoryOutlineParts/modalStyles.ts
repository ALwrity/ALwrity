/**
 * Shared styling for the cream-themed Story Writer modals rendered in the
 * Outline phase (EditSectionModal, ImageEditModal, AudioScriptModal,
 * TitleEditModal, CharactersModal, KeyEventsModal).
 *
 * Why this exists: the app's global MUI theme is dark, so TextFields,
 * DialogTitle, DialogContent, and DialogActions inside these modals inherit
 * light/white text colors. The modals themselves render with a white Paper
 * background, producing unreadable white-on-white text. Spreading
 * `modalPaperSx` onto `PaperProps={{ sx: modalPaperSx }}` cascades warm
 * dark-brown text colors to every descendant that doesn't explicitly
 * override `color`, fixing readability for titles, body text, labels,
 * inputs, helper text, and buttons alike.
 */
export const modalPaperSx = {
  backgroundColor: '#FAF9F6',
  color: '#2C2416',
  borderRadius: 3,
  border: '1px solid rgba(141, 110, 99, 0.28)',
  boxShadow: '0 24px 64px rgba(44, 36, 22, 0.22)',
  // Cascade dark-brown text to every default-styled descendant.
  '& .MuiDialogTitle-root': {
    color: '#2C2416',
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  '& .MuiDialogContent-root': {
    color: '#2C2416',
    borderColor: 'rgba(141, 110, 99, 0.22)',
  },
  '& .MuiDialogActions-root': {
    color: '#2C2416',
    borderColor: 'rgba(141, 110, 99, 0.22)',
    // Make every action button label readable by default.
    '& .MuiButton-root': {
      color: '#5D4037',
    },
    '& .MuiButton-contained': {
      color: '#FAF9F6',
      background: 'linear-gradient(90deg, #5D4037, #3E2723)',
      '&:hover': {
        background: 'linear-gradient(90deg, #3E2723, #2C2416)',
      },
    },
  },
  '& .MuiFormLabel-root': {
    color: '#5D4037',
    fontWeight: 500,
    '&.Mui-focused': {
      color: '#3E2723',
      fontWeight: 600,
    },
  },
  '& .MuiInputBase-root': {
    color: '#2C2416',
    backgroundColor: '#FFFFFF',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(141, 110, 99, 0.4)',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#5D4037',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#3E2723',
      borderWidth: '1.5px',
    },
  },
  '& .MuiInputBase-input': {
    color: '#2C2416',
    '&::placeholder': {
      color: '#8D6E63',
      opacity: 0.7,
    },
  },
  '& .MuiFormHelperText-root': {
    color: '#5D4037',
  },
  '& .MuiTypography-root': {
    color: 'inherit',
  },
  '& .MuiChip-root': {
    color: '#2C2416',
    borderColor: 'rgba(141, 110, 99, 0.35)',
    backgroundColor: '#FFFFFF',
  },
  '& .MuiPaper-root': {
    backgroundColor: '#FFFFFF',
    color: '#2C2416',
    borderColor: 'rgba(141, 110, 99, 0.28)',
  },
  '& .MuiDivider-root': {
    borderColor: 'rgba(141, 110, 99, 0.2)',
  },
} as const;

/**
 * `MenuProps.sx` for any `<Select>` rendered inside these modals. The portal-
 * rendered dropdown Paper must also adopt the cream theme so option list items
 * stay readable when these modals include a Select (e.g. AudioScriptModal's
 * voice / emotion pickers).
 */
export const modalSelectMenuPaperSx = {
  backgroundColor: '#FAF9F6',
  color: '#2C2416',
  border: '1px solid rgba(141, 110, 99, 0.3)',
  boxShadow: '0 12px 28px rgba(44, 36, 22, 0.18)',
  borderRadius: 2,
  mt: 0.5,
  '& .MuiMenuItem-root': {
    color: '#2C2416',
    fontSize: '0.875rem',
    '&:hover': {
      backgroundColor: '#F1ECDD',
    },
    '&.Mui-selected': {
      backgroundColor: 'rgba(93, 64, 55, 0.12)',
      color: '#3E2723',
      fontWeight: 600,
    },
    '&.Mui-selected:hover': {
      backgroundColor: 'rgba(93, 64, 55, 0.18)',
    },
  },
};

export const modalSelectMenuProps = {
  MenuProps: {
    sx: modalSelectMenuPaperSx,
    PaperProps: {
      sx: modalSelectMenuPaperSx,
    },
    anchorOrigin: { vertical: 'bottom', horizontal: 'left' } as const,
    transformOrigin: { vertical: 'top', horizontal: 'left' } as const,
  },
} as const;