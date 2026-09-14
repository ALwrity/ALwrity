/** Shared vertical sizing for wizard header and footer chrome bars. */
export const WIZARD_CHROME_BAR_PADDING = { xs: 1.5, md: 2.24 } as const;

/** Horizontal padding for step page bodies below the progress bar (all onboarding steps). */
export const ONBOARDING_STEP_CONTENT_PADDING_X = { xs: 1.25, md: 2 } as const;

/** Top padding between the progress bar and step hero/content. */
export const ONBOARDING_STEP_CONTENT_PADDING_TOP = {
  connect: { xs: 1, md: 1.5 },
  default: { xs: 1, md: 1.5 },
} as const;

export const WIZARD_CHROME_BAR_SX = {
  px: WIZARD_CHROME_BAR_PADDING,
  py: WIZARD_CHROME_BAR_PADDING,
  minHeight: { xs: 56, sm: 60, md: 72 },
  display: 'flex',
  alignItems: 'center',
} as const;
