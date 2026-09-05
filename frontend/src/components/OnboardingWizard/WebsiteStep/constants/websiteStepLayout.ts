/** Baseline MUI spacing between the 4-step progress bar and "Where should I begin?" */
export const WEBSITE_STEP_HEADER_BASE_TOP_SPACING = { xs: 1.75, md: 2.25 } as const;

/** Additional top margin applied to WebsiteStepHeader (+40% over baseline). */
export const WEBSITE_STEP_HEADER_TOP_MARGIN = {
  xs: WEBSITE_STEP_HEADER_BASE_TOP_SPACING.xs * 0.4,
  md: WEBSITE_STEP_HEADER_BASE_TOP_SPACING.md * 0.4,
} as const;

export const STEP0_NAV_TITLE = 'Build Your Brand Engine';
