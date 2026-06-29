import type { Step } from 'react-joyride';

/** localStorage key — first visit auto-starts the studio tour when unset. */
export const LINKEDIN_STUDIO_TOUR_SEEN_KEY = 'linkedin_studio_tour_seen';

const TOUR_TOOLTIP_STYLE = {
  tooltip: { maxWidth: 300 },
};

const VIEWPORT_FLOATER = {
  options: {
    preventOverflow: {
      boundariesElement: 'viewport' as const,
      padding: 16,
    },
  },
};

const WEDGE_PLAN: Step = {
  target: '[data-tour="li-wedge-plan"]',
  title: 'Plan — strategy first',
  content:
    'Start your content workflow here. Brainstorm ideas with persona-aware research, open Industry Watchdog to monitor trends, and shape what you will publish before you write.',
  placement: 'top',
  disableBeacon: true,
  styles: TOUR_TOOLTIP_STYLE,
};

const WEDGE_CREATE: Step = {
  target: '[data-tour="li-wedge-create"]',
  title: 'Create — draft faster',
  content:
    'Turn ideas into LinkedIn posts, articles, video scripts, and carousels. Tap Get Topic Ideas for AI suggestions matched to your profile, then pick a format to open Quick Create.',
  placement: 'right',
  styles: TOUR_TOOLTIP_STYLE,
};

const WEDGE_PUBLISH: Step = {
  target: '[data-tour="li-wedge-publish"]',
  title: 'Publish — ship with confidence',
  content:
    'Open saved drafts from your asset library or jump to the content calendar to schedule posts when your audience is most active.',
  placement: 'right',
  styles: TOUR_TOOLTIP_STYLE,
};

const WEDGE_ANALYSIS: Step = {
  target: '[data-tour="li-wedge-analysis"]',
  title: 'Analysis — measure what works',
  content:
    'Review profile strength, post performance, and SEO visibility so every piece of content improves your LinkedIn presence.',
  placement: 'bottom',
  styles: TOUR_TOOLTIP_STYLE,
};

const WEDGE_ENGAGEMENT: Step = {
  target: '[data-tour="li-wedge-engagement"]',
  title: 'Engagement — grow reach',
  content:
    'Use the growth engine to boost interaction, expand reach, and turn passive viewers into active followers.',
  placement: 'left',
  styles: TOUR_TOOLTIP_STYLE,
};

const WEDGE_REMARKET: Step = {
  target: '[data-tour="li-wedge-remarket"]',
  title: 'Remarket — refresh winners',
  content:
    'Identify high-performing posts and repurpose or refresh them to extend the life of your best LinkedIn content.',
  placement: 'left',
  styles: TOUR_TOOLTIP_STYLE,
};

/** Welcome → connect → lifecycle pie → wedges (Plan & Create first) → replay hint. */
export const linkedInStudioTourSteps: Step[] = [
  {
    target: 'body',
    title: 'Welcome to LinkedIn Studio',
    content:
      'This quick tour shows how to use the studio dashboard — your command center for planning, creating, publishing, and improving LinkedIn content.',
    placement: 'center',
    disableBeacon: true,
    styles: TOUR_TOOLTIP_STYLE,
  },
  {
    target: '[data-tour="li-connect-action"]',
    title: 'Connect LinkedIn',
    content:
      'Click Connect LinkedIn to link your account. This unlocks publishing, analytics, topic ideas, and profile tools across the studio.',
    placement: 'top',
    disableScrolling: true,
    spotlightPadding: 4,
    styles: TOUR_TOOLTIP_STYLE,
    floaterProps: VIEWPORT_FLOATER,
  },
  {
    target: '[data-tour="li-content-lifecycle"]',
    title: 'LinkedIn content lifecycle',
    content:
      'These six wedges map your full LinkedIn workflow — from planning through remarketing. Click any wedge to open its tools. Next we walk through each step, starting with Plan.',
    placement: 'bottom',
    disableScrolling: true,
    spotlightPadding: 4,
    styles: TOUR_TOOLTIP_STYLE,
    floaterProps: VIEWPORT_FLOATER,
  },
  WEDGE_PLAN,
  WEDGE_CREATE,
  WEDGE_PUBLISH,
  WEDGE_ANALYSIS,
  WEDGE_ENGAGEMENT,
  WEDGE_REMARKET,
  {
    target: '[data-tour="li-tour-trigger"]',
    title: 'You are ready',
    content:
      'Replay this tour anytime from the Tour button. Start with Plan or Create — connect LinkedIn when you are ready to publish.',
    placement: 'bottom',
    styles: TOUR_TOOLTIP_STYLE,
  },
];
