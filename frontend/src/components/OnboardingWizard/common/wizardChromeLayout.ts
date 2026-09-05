/** Shared vertical sizing for wizard header and footer chrome bars. */
export const WIZARD_CHROME_BAR_PADDING = { xs: 1.5, md: 2.24 } as const;

export const WIZARD_CHROME_BAR_SX = {
  px: WIZARD_CHROME_BAR_PADDING,
  py: WIZARD_CHROME_BAR_PADDING,
  minHeight: { xs: 56, sm: 60, md: 72 },
  display: 'flex',
  alignItems: 'center',
} as const;
