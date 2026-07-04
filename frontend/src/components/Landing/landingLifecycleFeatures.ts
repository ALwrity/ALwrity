/**
 * Lifecycle card CTAs — post-sign-in destinations (TC 021).
 * Each href must match a protected route in App.tsx.
 */
export type LandingLifecycleFeature = {
  title: string;
  description: string;
  badge: string;
  /** Protected app route after Clerk sign-in */
  href: string;
  iconKey: 'plan' | 'generate' | 'publish' | 'analyze' | 'engage' | 'remarket';
};

export const LANDING_LIFECYCLE_FEATURES: readonly LandingLifecycleFeature[] = [
  {
    iconKey: 'plan',
    title: 'Content Planning',
    description:
      'AI builds a living strategy and your content calendar from your goals, audience, and market signals. Drag, drop, and approve.',
    badge: 'Strategy',
    href: '/content-planning',
  },
  {
    iconKey: 'generate',
    title: 'Content Generation',
    description:
      'Generate text, images, audio, video and channel-ready posts for LinkedIn, Facebook, Instagram and blogs. Templates, brand voice and Personas baked in.',
    badge: 'Multi‑Format',
    href: '/blog-writer',
  },
  {
    iconKey: 'publish',
    title: 'Content Publishing',
    description:
      'Publish and schedule directly to connected social channels and your website. One-click cross‑posting while preserving native formats.',
    badge: 'Automated',
    href: '/scheduler-dashboard',
  },
  {
    iconKey: 'analyze',
    title: 'Content Analytics',
    description:
      'Pulls analytics from connected platforms, analyzes with AI and surfaces actionable insights. Signals flow back to strategy and calendar for adaptive learning.',
    badge: 'AI Insights',
    href: '/seo-dashboard',
  },
  {
    iconKey: 'engage',
    title: 'Content Engagement',
    description:
      'Monitor comments, DMs and reactions. Research communities and reply with AI assistance from within ALwrity to grow audience authentically.',
    badge: 'Community',
    href: '/linkedin-writer',
  },
  {
    iconKey: 'remarket',
    title: 'Content Remarketing',
    description:
      'Analyzes historic performance, suggests edits, variants and redistribution. Measures KPI attainment and explains what worked—and what did not.',
    badge: 'Optimization',
    href: '/seo-dashboard',
  },
] as const;
