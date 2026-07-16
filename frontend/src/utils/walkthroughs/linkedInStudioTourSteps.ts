import type { Step } from 'react-joyride';
import {
  TOUR_BREAKPOINT_MOBILE_PX,
  TOUR_BREAKPOINT_TABLET_PX,
  TourViewportVariant,
  getTourViewportVariant,
  hasTourBeenSeen,
  isTourCompactViewport,
  markTourSkipReminderShown,
  readTourCompletionStatus,
  shouldShowTourSkipReminder,
} from './alwrityJoyrideTheme';

/** localStorage key prefix — tour auto-starts once per signed-in user when unset. */
export const LINKEDIN_STUDIO_TOUR_SEEN_KEY = 'linkedin_studio_tour_seen';

export const LINKEDIN_STUDIO_TOUR_SKIP_REMINDER_MESSAGE =
  'Need a quick refresher? Tap the Tour button anytime — no pressure.';

/** Per-user key; returns null until Clerk user id is available. */
export function getLinkedInStudioTourSeenKey(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return `${LINKEDIN_STUDIO_TOUR_SEEN_KEY}_${userId}`;
}

/** True when this signed-in user has finished or skipped the studio tour. */
export function hasSeenLinkedInStudioTour(userId: string | null | undefined): boolean {
  const key = getLinkedInStudioTourSeenKey(userId);
  if (!key) return true;
  return hasTourBeenSeen(key);
}

export function shouldShowLinkedInStudioSkipReminder(userId: string | null | undefined): boolean {
  const key = getLinkedInStudioTourSeenKey(userId);
  if (!key) return false;
  return shouldShowTourSkipReminder(key);
}

export function markLinkedInStudioSkipReminderShown(userId: string | null | undefined): void {
  const key = getLinkedInStudioTourSeenKey(userId);
  if (!key) return;
  markTourSkipReminderShown(key);
}

export function getLinkedInStudioTourStatus(userId: string | null | undefined) {
  const key = getLinkedInStudioTourSeenKey(userId);
  if (!key) return null;
  return readTourCompletionStatus(key);
}

export const TOUR_AUTO_START_DELAY_DESKTOP_MS = 800;
export const TOUR_AUTO_START_DELAY_TABLET_MS = 1500;
export const TOUR_AUTO_START_DELAY_MOBILE_MS = 2400;

export function getTourAutoStartDelayMs(): number {
  const variant = getTourViewportVariant();
  if (variant === 'mobile') return TOUR_AUTO_START_DELAY_MOBILE_MS;
  if (variant === 'tablet') return TOUR_AUTO_START_DELAY_TABLET_MS;
  return TOUR_AUTO_START_DELAY_DESKTOP_MS;
}

/** @deprecated Use TourViewportVariant from alwrityJoyrideTheme */
export type StudioTourVariant = TourViewportVariant;

export function getStudioTourVariant(): TourViewportVariant {
  return getTourViewportVariant();
}

export function isStudioTourCompactViewport(): boolean {
  return isTourCompactViewport();
}

const DESKTOP_TOOLTIP_STYLE = {
  tooltip: { maxWidth: 320 },
};

const MOBILE_TOOLTIP_STYLE = {
  tooltip: { maxWidth: 'min(336px, 92vw)' },
};

const TABLET_TOOLTIP_STYLE = {
  tooltip: { maxWidth: 'min(360px, 90vw)' },
};

const VIEWPORT_FLOATER = {
  options: {
    preventOverflow: {
      boundariesElement: 'viewport' as const,
      padding: 16,
    },
  },
};

const WELCOME_STEP: Step = {
  target: 'body',
  title: 'Welcome to LinkedIn Studio',
  content:
    'This quick tour shows how to use Studio dashboard — Plan → Create → Publish → Engage → Grow on LinkedIn',
  placement: 'center',
  disableBeacon: true,
  styles: DESKTOP_TOOLTIP_STYLE,
};

const CONNECT_STEP: Step = {
  target: '[data-tour="li-connect-action"]',
  title: 'Connect when you are ready to publish',
  content:
    'Use the Connect LinkedIn button here before your first post. Explore Plan and Create now — connect before you publish.',
  placement: 'top',
  spotlightPadding: 4,
  styles: DESKTOP_TOOLTIP_STYLE,
  floaterProps: VIEWPORT_FLOATER,
};

const CONNECTED_STEP: Step = {
  target: '[data-tour="li-profile-hub"]',
  title: "You're connected",
  content:
    'Your LinkedIn account is linked. Your profile hub shows strength insights, topic ideas, and quick actions — ready when you are.',
  placement: 'bottom',
  spotlightPadding: 4,
  styles: DESKTOP_TOOLTIP_STYLE,
  floaterProps: VIEWPORT_FLOATER,
};

const LIFECYCLE_STEP: Step = {
  target: '[data-tour="li-content-lifecycle"]',
  title: 'LinkedIn content lifecycle',
  content:
    'These six wedges map your full LinkedIn workflow — from planning through remarketing. Tap any wedge to open its tools.',
  placement: 'bottom',
  spotlightPadding: 4,
  styles: DESKTOP_TOOLTIP_STYLE,
  floaterProps: VIEWPORT_FLOATER,
};

const WEDGE_PLAN: Step = {
  target: '[data-tour="li-wedge-plan"]',
  title: 'Plan — strategy first',
  content:
    'Start your content workflow here. Brainstorm ideas with persona-aware research, open Industry Watchdog to monitor trends, and shape what you will publish before you write.',
  placement: 'top',
  disableBeacon: true,
  styles: DESKTOP_TOOLTIP_STYLE,
};

const WEDGE_CREATE: Step = {
  target: '[data-tour="li-wedge-create"]',
  title: 'Create — draft faster',
  content:
    'Turn ideas into LinkedIn posts, articles, video scripts, and carousels. Tap Get Topic Ideas for AI suggestions matched to your profile, then pick a format to open Quick Create.',
  placement: 'right',
  styles: DESKTOP_TOOLTIP_STYLE,
};

const WEDGE_PUBLISH: Step = {
  target: '[data-tour="li-wedge-publish"]',
  title: 'Publish — ship with confidence',
  content:
    'Open saved drafts from your asset library or jump to the content calendar to schedule posts when your audience is most active.',
  placement: 'right',
  styles: DESKTOP_TOOLTIP_STYLE,
};

const WEDGE_ANALYSIS: Step = {
  target: '[data-tour="li-wedge-analysis"]',
  title: 'Analysis — measure what works',
  content:
    'Review profile strength, post performance, and SEO visibility so every piece of content improves your LinkedIn presence.',
  placement: 'bottom',
  styles: DESKTOP_TOOLTIP_STYLE,
};

const WEDGE_ENGAGEMENT: Step = {
  target: '[data-tour="li-wedge-engagement"]',
  title: 'Engagement — grow reach',
  content:
    'Use the growth engine to boost interaction, expand reach, and turn passive viewers into active followers.',
  placement: 'left',
  styles: DESKTOP_TOOLTIP_STYLE,
};

const WEDGE_REMARKET: Step = {
  target: '[data-tour="li-wedge-remarket"]',
  title: 'Remarket — refresh winners',
  content:
    'Identify high-performing posts and repurpose or refresh them to extend the life of your best LinkedIn content.',
  placement: 'left',
  styles: DESKTOP_TOOLTIP_STYLE,
};

const DONE_STEP: Step = {
  target: '[data-tour="li-tour-trigger"]',
  title: "You're all set!",
  content:
    'Replay this tour anytime from the Tour guide button. Start with Plan or Create — connect LinkedIn when you are ready to publish.',
  placement: 'bottom',
  styles: DESKTOP_TOOLTIP_STYLE,
};

const MOBILE_PLAN_STEP: Step = {
  target: '[data-tour="li-wedge-plan"]',
  title: 'Plan — start here',
  content: 'Brainstorm ideas, track industry news with Watchdog, and build your weekly content plan.',
  placement: 'bottom',
  disableBeacon: true,
  styles: MOBILE_TOOLTIP_STYLE,
  floaterProps: VIEWPORT_FLOATER,
};

const MOBILE_CREATE_STEP: Step = {
  target: '[data-tour="li-wedge-create"]',
  title: 'Create — draft content',
  content: 'Turn ideas into posts, articles, carousels, or video scripts. Use Get Topic Ideas for AI suggestions.',
  placement: 'bottom',
  styles: MOBILE_TOOLTIP_STYLE,
  floaterProps: VIEWPORT_FLOATER,
};

const MOBILE_PUBLISH_STEP: Step = {
  target: '[data-tour="li-wedge-publish"]',
  title: 'Publish — go live',
  content: 'Open saved drafts, schedule posts, and ship content when your audience is most active.',
  placement: 'bottom',
  styles: MOBILE_TOOLTIP_STYLE,
  floaterProps: VIEWPORT_FLOATER,
};

const TABLET_ANALYTICS_STEP: Step = {
  target: '[data-tour="li-mobile-analytics"]',
  title: 'Analytics & Knowledge',
  content:
    'Scroll down to find your Analytics card and Knowledge Center tools — view post stats, open your library, and explore ALwrity features.',
  placement: 'top',
  styles: TABLET_TOOLTIP_STYLE,
  floaterProps: VIEWPORT_FLOATER,
};

const COMPACT_DONE_STEP: Step = {
  target: '[data-tour="li-tour-trigger"]',
  title: "You're all set!",
  content: 'Replay this tour from the Tour button. Try Plan or Create to make your first post.',
  placement: 'bottom',
  styles: MOBILE_TOOLTIP_STYLE,
  floaterProps: VIEWPORT_FLOATER,
};

const TABLET_DONE_STEP: Step = {
  ...COMPACT_DONE_STEP,
  styles: TABLET_TOOLTIP_STYLE,
};

function adaptStepForCompact(step: Step, tooltipStyle: typeof MOBILE_TOOLTIP_STYLE): Step {
  if (step.placement === 'center') {
    return { ...step, styles: { ...step.styles, ...tooltipStyle } };
  }
  return {
    ...step,
    placement: 'bottom',
    styles: { ...step.styles, ...tooltipStyle },
    floaterProps: VIEWPORT_FLOATER,
  };
}

export interface BuildStudioTourStepsOptions {
  connected: boolean;
  variant?: TourViewportVariant;
}

/** Build desktop, tablet, or mobile-lite tour based on viewport and connection state. */
export function buildLinkedInStudioTourSteps({
  connected,
  variant = getTourViewportVariant(),
}: BuildStudioTourStepsOptions): Step[] {
  const accountStep = connected ? CONNECTED_STEP : CONNECT_STEP;

  if (variant === 'mobile') {
    return [
      adaptStepForCompact(WELCOME_STEP, MOBILE_TOOLTIP_STYLE),
      adaptStepForCompact(LIFECYCLE_STEP, MOBILE_TOOLTIP_STYLE),
      MOBILE_PLAN_STEP,
      MOBILE_CREATE_STEP,
      MOBILE_PUBLISH_STEP,
      COMPACT_DONE_STEP,
    ];
  }

  if (variant === 'tablet') {
    return [
      adaptStepForCompact(WELCOME_STEP, TABLET_TOOLTIP_STYLE),
      adaptStepForCompact(LIFECYCLE_STEP, TABLET_TOOLTIP_STYLE),
      { ...MOBILE_PLAN_STEP, styles: TABLET_TOOLTIP_STYLE },
      { ...MOBILE_CREATE_STEP, styles: TABLET_TOOLTIP_STYLE },
      { ...MOBILE_PUBLISH_STEP, styles: TABLET_TOOLTIP_STYLE },
      TABLET_ANALYTICS_STEP,
      TABLET_DONE_STEP,
    ];
  }

  return [
    WELCOME_STEP,
    { ...accountStep, disableScrolling: true },
    { ...LIFECYCLE_STEP, disableScrolling: true },
    WEDGE_PLAN,
    WEDGE_CREATE,
    WEDGE_PUBLISH,
    WEDGE_ANALYSIS,
    WEDGE_ENGAGEMENT,
    WEDGE_REMARKET,
    DONE_STEP,
  ];
}

/** @deprecated Use buildLinkedInStudioTourSteps — kept for imports that expect a static list. */
export const linkedInStudioTourSteps: Step[] = buildLinkedInStudioTourSteps({
  connected: false,
  variant: 'desktop',
});

export { TOUR_BREAKPOINT_MOBILE_PX, TOUR_BREAKPOINT_TABLET_PX };
