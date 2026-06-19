/** Shared typography for landing page section headers (all sections except Hero). */
export const landingSectionTitleSx = {
  fontWeight: 700,
  fontSize: { xs: '2rem', md: '2.75rem' },
  letterSpacing: '-0.02em',
  lineHeight: 1.15,
} as const;

export const landingSectionSubtitleSx = {
  fontWeight: 500,
  fontSize: { xs: '1rem', md: '1.125rem' },
  lineHeight: 1.55,
} as const;

/** Vertical rhythm between header → subtitle → content blocks */
export const landingSectionStackSpacing = { xs: 2, md: 2.75 } as const;

/** Extra gap between section title block and following strip/cards */
export const landingSectionHeaderGap = { xs: 2.5, md: 3.5 } as const;

/** Shared hover lift for landing cards */
export const landingCardHoverSx = {
  transition: 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.35s ease, border-color 0.25s ease',
  transformOrigin: 'center bottom',
  '&:hover': {
    transform: 'scale(1.06) translateY(-10px)',
    zIndex: 3,
  },
} as const;
