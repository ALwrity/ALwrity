// Shared styles for Story Setup components

export const textFieldStyles = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: '#FFFFFF',
    color: '#1A1611',
    '& fieldset': {
      borderColor: '#8D6E63',
      borderWidth: '1.5px',
    },
    '&:hover fieldset': {
      borderColor: '#5D4037',
    },
    '&.Mui-focused fieldset': {
      borderColor: '#3E2723',
      borderWidth: '2px',
    },
  },
  '& .MuiInputLabel-root': {
    color: '#3E2723',
    fontWeight: 500,
    '&.Mui-focused': {
      color: '#1A1611',
      fontWeight: 600,
    },
    '&.Mui-required': {
      '&::after': {
        color: '#D32F2F',
      },
    },
  },
  '& .MuiFormHelperText-root': {
    color: '#5D4037',
    fontSize: '0.875rem',
    fontWeight: 400,
    marginTop: '4px',
  },
  '& .MuiInputBase-input': {
    color: '#1A1611',
    '&::placeholder': {
      color: '#8D6E63',
      opacity: 0.7,
    },
  },
  '& .MuiSelect-select': {
    color: '#1A1611',
  },
  '& .MuiMenuItem-root': {
    color: '#1A1611',
    '&:hover': {
      backgroundColor: '#F7F3E9',
    },
    '&.Mui-selected': {
      backgroundColor: '#E8E5D3',
      '&:hover': {
        backgroundColor: '#E8E5D3',
      },
    },
  },
};

export const paperStyles = {
  p: 4,
  mt: 2,
  backgroundColor: '#F7F3E9', // Warm cream/parchment color
  color: '#2C2416', // Dark brown text for readability
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.08)',
};

export const accordionStyles = {
  mb: 2,
  backgroundColor: '#FAF9F6', // Slightly lighter cream for accordions
  '&:before': {
    display: 'none', // Remove default border
  },
};

export const cardStyles = {
  backgroundColor: '#FAF9F6', // Slightly lighter cream for cards
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
};

/**
 * `MenuProps.sx` for MUI `Select` dropdown paper. MUI renders the open menu
 * inside a portal at <body>, so the `& .MuiMenuItem-root` overrides in
 * `textFieldStyles` (which are scoped inside the Select's own root) never
 * reach the dropdown. Apply this via `<TextField SelectProps={{ MenuProps: { sx: selectMenuPaperSx } }} />`
 * to give the dropdown the same warm cream / dark brown theme as the rest of
 * the Story Writer setup screen.
 */
export const selectMenuPaperSx = {
  // The Paper that wraps the menu list.
  backgroundColor: '#FAF9F6',
  border: '1px solid rgba(141, 110, 99, 0.3)',
  boxShadow: '0 12px 28px rgba(44, 36, 22, 0.18)',
  borderRadius: 2,
  mt: 0.5,
  // The scrollable list inside.
  '& .MuiList-root': {
    paddingTop: 4,
    paddingBottom: 4,
  },
  '& .MuiMenuItem-root': {
    color: '#2C2416',
    fontSize: '0.875rem',
    paddingTop: 6,
    paddingBottom: 6,
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

/**
 * Pre-built `SelectProps` containing the cream-themed `MenuProps`. Spread
 * this onto a `<TextField ... SelectProps={selectMenuProps} />` to get a
 * dropdown that matches the Story Writer palette.
 */
export const selectMenuProps = {
  MenuProps: {
    sx: selectMenuPaperSx,
    // Keep the dropdown anchored to the field, avoiding off-screen popovers.
    anchorOrigin: { vertical: 'bottom', horizontal: 'left' } as const,
    transformOrigin: { vertical: 'top', horizontal: 'left' } as const,
    PaperProps: {
      sx: selectMenuPaperSx,
    },
  },
};

