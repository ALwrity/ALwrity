import { alpha, type Theme } from '@mui/material/styles';

/** Shared dark section shell — prevents white gaps between landing sections on mobile. */
export const landingDarkSectionSx = {
  position: 'relative' as const,
  bgcolor: '#0a0a0a',
  overflow: 'hidden' as const,
};

export const landingSectionBackgroundLayerBaseSx = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  pointerEvents: 'none' as const,
};

/** For ::before / ::after pseudo-element background layers. */
export const landingSectionBackgroundLayerSx = {
  content: '""',
  ...landingSectionBackgroundLayerBaseSx,
};

/** Extend image layers past section edges on mobile to eliminate white seams. */
export const landingMobileBackgroundBleedSx = {
  top: { xs: -72, md: 0 },
  bottom: { xs: -72, md: 0 },
  left: { xs: -28, md: 0 },
  right: { xs: -28, md: 0 },
  transform: { xs: 'scale(1.4)', md: 'none' },
  transformOrigin: 'center center',
};

/** Extra bleed at section seams on mobile — prevents white hairlines between dark sections. */
export const landingMobileSeamBleedSx = {
  top: { xs: -80, md: 0 },
  bottom: { xs: -80, md: 0 },
};

export const landingMobileCompactCardContentSx = {
  p: { xs: 1.25, md: 2.5 },
  '&:last-child': { pb: { xs: 1.25, md: 2.5 } },
};

/** Welcome-section glass card — shared by Section 2 and Section 5 mobile cards. */
export const landingGlassCardSx = {
  background:
    'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 3,
  boxShadow: '0 12px 28px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
} as const;

/** Primary-gradient icon box for welcome-style landing cards. */
export const landingWelcomeIconBoxSx = (theme: Theme) =>
  ({
    width: { xs: 36, md: 44 },
    height: { xs: 36, md: 44 },
    borderRadius: 2,
    background: `linear-gradient(45deg, ${alpha(theme.palette.primary.main, 0.2)}, ${alpha(theme.palette.secondary.main, 0.2)})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.primary.main,
    flexShrink: 0,
    '& .MuiSvgIcon-root': { fontSize: { xs: 18, md: 22 } },
  }) as const;
