import type { Styles } from 'react-joyride';

export const TOUR_BREAKPOINT_MOBILE_PX = 640;
export const TOUR_BREAKPOINT_TABLET_PX = 960;

export type TourViewportVariant = 'mobile' | 'tablet' | 'desktop';

export function getTourViewportVariant(): TourViewportVariant {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia(`(max-width: ${TOUR_BREAKPOINT_MOBILE_PX}px)`).matches) return 'mobile';
  if (window.matchMedia(`(max-width: ${TOUR_BREAKPOINT_TABLET_PX}px)`).matches) return 'tablet';
  return 'desktop';
}

export function isTourCompactViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${TOUR_BREAKPOINT_TABLET_PX}px)`).matches;
}

/** Shared button labels across ALwrity product tours. */
export const ALWRITY_JOYRIDE_LOCALE = {
  back: 'Back',
  close: 'Close',
  last: 'Done',
  next: 'Next',
  skip: 'Skip for now',
} as const;

export type TourCompletionStatus = 'finished' | 'skipped';

const SKIP_REMINDER_SUFFIX = '_skip_reminder_shown';

/** Backward-compatible: true | finished | skipped all count as seen. */
export function readTourCompletionStatus(storageKey: string): TourCompletionStatus | null {
  const value = localStorage.getItem(storageKey);
  if (value === 'finished' || value === 'skipped') return value;
  if (value === 'true') return 'finished';
  return null;
}

export function hasTourBeenSeen(storageKey: string): boolean {
  return readTourCompletionStatus(storageKey) !== null;
}

export function markTourFinished(storageKey: string): void {
  localStorage.setItem(storageKey, 'finished');
}

export function markTourSkipped(storageKey: string): void {
  localStorage.setItem(storageKey, 'skipped');
}

export function shouldShowTourSkipReminder(storageKey: string): boolean {
  return (
    readTourCompletionStatus(storageKey) === 'skipped' &&
    localStorage.getItem(`${storageKey}${SKIP_REMINDER_SUFFIX}`) !== '1'
  );
}

export function markTourSkipReminderShown(storageKey: string): void {
  localStorage.setItem(`${storageKey}${SKIP_REMINDER_SUFFIX}`, '1');
}

export interface AlwrityJoyrideStyleOptions {
  primaryColor?: string;
  zIndex?: number;
}

function buildSecondaryTourButtonStyle() {
  return {
    backgroundColor: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    boxSizing: 'border-box' as const,
    color: '#475569',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.15,
    margin: 0,
    minHeight: 28,
    padding: '5px 8px',
    WebkitAppearance: 'none' as const,
  };
}

function buildPrimaryTourButtonStyle(primaryColor: string) {
  return {
    backgroundColor: primaryColor,
    border: `1px solid ${primaryColor}`,
    borderRadius: 6,
    boxSizing: 'border-box' as const,
    color: '#ffffff',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.15,
    margin: 0,
    minHeight: 28,
    padding: '5px 10px',
    WebkitAppearance: 'none' as const,
  };
}

export function getAlwrityJoyrideStyles(
  variant: TourViewportVariant,
  options: AlwrityJoyrideStyleOptions = {},
): Partial<Styles> {
  const primaryColor = options.primaryColor ?? '#0a66c2';
  const zIndex = options.zIndex ?? 13000;
  const secondaryButton = buildSecondaryTourButtonStyle();
  const primaryButton = buildPrimaryTourButtonStyle(primaryColor);

  const widthByVariant =
    variant === 'mobile'
      ? 'min(336px, 92vw)'
      : variant === 'tablet'
        ? 'min(360px, 90vw)'
        : 320;

  const maxWidthByVariant =
    variant === 'mobile'
      ? 'min(336px, 92vw)'
      : variant === 'tablet'
        ? 'min(360px, 90vw)'
        : 320;

  return {
    options: {
      primaryColor,
      textColor: '#1e293b',
      backgroundColor: '#ffffff',
      overlayColor: 'rgba(15, 23, 42, 0.55)',
      zIndex,
      arrowColor: '#ffffff',
      width: widthByVariant,
    },
    tooltip: {
      borderRadius: 12,
      padding: variant === 'tablet' ? '16px 18px' : '14px 16px',
      boxShadow: '0 16px 48px rgba(10, 102, 194, 0.18)',
      maxWidth: maxWidthByVariant,
    },
    tooltipTitle: {
      fontSize: variant === 'tablet' ? 16 : 15,
      fontWeight: 700,
      marginBottom: 4,
    },
    tooltipContent: {
      fontSize: variant === 'tablet' ? 14 : 13,
      lineHeight: 1.5,
      padding: '2px 0 0',
    },
    tooltipFooter: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'nowrap',
      gap: 6,
      justifyContent: 'flex-end',
      marginTop: 12,
    },
    tooltipFooterSpacer: {
      display: 'flex',
      flex: 1,
      justifyContent: 'flex-start',
      minWidth: 0,
    },
    buttonNext: primaryButton,
    buttonBack: {
      ...secondaryButton,
      marginLeft: 0,
      marginRight: 0,
    },
    buttonSkip: {
      ...secondaryButton,
      flexShrink: 0,
      whiteSpace: 'nowrap',
    },
    spotlight: {
      borderRadius: 12,
    },
  };
}

/** Remove leftover Joyride overlay/spotlight DOM after a mid-tour dismiss. */
export function cleanupJoyrideOverlay(): void {
  requestAnimationFrame(() => {
    document.getElementById('react-joyride-portal')?.remove();
    document.querySelectorAll('.react-joyride__spotlight').forEach((node) => node.remove());
  });
}

/** Move screen reader / keyboard focus into the active Joyride tooltip. */
export function focusJoyrideTooltip(): void {
  requestAnimationFrame(() => {
    const tooltip = document.querySelector('.react-joyride__tooltip');
    if (!tooltip) return;
    const focusable = tooltip.querySelector<HTMLElement>(
      'button[data-action="primary"], button[data-action="next"], button[data-action="last"]',
    );
    focusable?.focus();
  });
}
