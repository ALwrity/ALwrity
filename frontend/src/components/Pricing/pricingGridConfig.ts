/**
 * End User Pricing Matrix — Jun 26 v3
 * Static Yes / — / Coming soon rows for Sections 1–3, 6–7.
 * Section 5 limits are API-driven (see pricingLimitDisplay.ts).
 */

export type PlanTier = 'free' | 'basic' | 'pro' | 'enterprise';

export const PLAN_TIER_ORDER: PlanTier[] = ['free', 'basic', 'pro', 'enterprise'];

export const PLAN_TIER_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export type StaticCellValue =
  | 'yes'
  | 'dash'
  | 'coming_soon'
  | 'contact_us'
  | 'starter'
  | 'standard'
  | 'advanced';

export interface PricingGridRow {
  id: string;
  label: string;
  shortDescription: string;
  tooltip: string;
  /** Opens Footnote information popup (AI Research* / AI Fact-check*) */
  footnote?: boolean;
  modalDetail?: string;
  cells: Record<PlanTier, StaticCellValue>;
}

export interface PricingGridSubgroup {
  id: string;
  title: string;
  defaultExpanded: boolean;
  rows: PricingGridRow[];
}

export interface PricingGridSection {
  id: string;
  title: string;
  bulbPopup: string;
  defaultExpanded: boolean;
  rows: PricingGridRow[];
  subgroups?: PricingGridSubgroup[];
}

export const RESEARCH_FACTCHECK_FOOTNOTE =
  'Live web data changes every day — facts, trends, and rankings evolve constantly. ALwrity helps you research and fact-check—your creative judgment always leads. Review before you publish.';

export const CONTENT_PLANNING_MODAL = [
  'Starter (Free): Core calendar and basic planning views',
  'Standard (Basic): Full planning workspace with strategy templates',
  'Advanced (Pro/Enterprise): Cross-tool analytics tied to planning decisions',
].join('\n');

const yes = (): Record<PlanTier, StaticCellValue> => ({
  free: 'yes',
  basic: 'yes',
  pro: 'yes',
  enterprise: 'yes',
});

export const PRICING_GRID_SECTIONS: PricingGridSection[] = [
  {
    id: 'content-creation',
    title: 'AI Content Creation Tools & Generators',
    bulbPopup:
      'Write, Design, and Create blogs, articles, social content, images, videos, audio, and research—all within a single AI Marketing Platform',
    defaultExpanded: true,
    rows: [
      {
        id: 'blog-writer',
        label: 'Blog Writer',
        shortDescription: 'Long-form articles and SEO-ready blog posts from a single brief',
        tooltip:
          'Turn keywords into publish-ready blogs with headings, meta ideas, and optimization hints',
        cells: yes(),
      },
      {
        id: 'facebook-writer',
        label: 'Facebook Writer',
        shortDescription: 'Posts, captions, and campaign copy tuned for Facebook',
        tooltip: 'Generate scroll-stopping Facebook content aligned to your brand voice',
        cells: yes(),
      },
      {
        id: 'linkedin-studio',
        label: 'LinkedIn Studio',
        shortDescription: 'Professional posts, articles, and carousels for LinkedIn',
        tooltip: 'Persona-aware LinkedIn content that matches your executive or brand voice',
        cells: yes(),
      },
      {
        id: 'story-studio',
        label: 'Story Studio',
        shortDescription: 'Short-form stories with outline, visuals, narration, and video',
        tooltip: 'Build campaign-ready story assets in one workflow',
        cells: yes(),
      },
      {
        id: 'podcast-studio',
        label: 'Podcast Studio',
        shortDescription: 'Podcast episodes: research, script, voice, images, audio, and video',
        tooltip: 'End-to-end podcast creation without switching tools',
        cells: yes(),
      },
      {
        id: 'youtube-studio',
        label: 'YouTube Studio',
        shortDescription: 'YouTube-focused scripts, assets, voice, and video assembly',
        tooltip: 'Plan and produce YouTube content with AI-assisted scripting and media',
        cells: yes(),
      },
      {
        id: 'image-studio',
        label: 'Image Studio',
        shortDescription: 'AI images plus editing for marketing and social',
        tooltip: 'Create and refine visuals for posts, ads, and landing pages',
        cells: yes(),
      },
      {
        id: 'video-studio',
        label: 'Video Studio',
        shortDescription: 'AI video generator, AI shorts, and AI avatar videos',
        tooltip: 'Produce short-form and avatar-led video without a production team',
        cells: yes(),
      },
      {
        id: 'audio-studio',
        label: 'Audio Studio',
        shortDescription: 'AI voice generation, cloning, and audio editing',
        tooltip: 'Natural voiceovers and audio polish for podcasts and video',
        cells: yes(),
      },
      {
        id: 'ai-research',
        label: 'AI Research*',
        shortDescription: 'Live web research to inform your content before you write',
        tooltip:
          'Research topics with fresh sources from across the web — built for content creators and marketers',
        footnote: true,
        cells: yes(),
      },
      {
        id: 'ai-fact-check',
        label: 'AI Fact-check*',
        shortDescription: 'Verify claims and cite trustworthy sources',
        tooltip: 'Built-in hallucination checks so your content stays credible and E-E-A-T friendly',
        footnote: true,
        cells: yes(),
      },
      {
        id: 'content-enhancers',
        label: 'Content Enhancers',
        shortDescription:
          'Assistive Writing, Smart Edit, SEO Content Optimization & AI Internal Linking Assistance',
        tooltip:
          'Polish drafts, optimize for search, and strengthen site structure — all inside your writing flow',
        cells: yes(),
      },
    ],
  },
  {
    id: 'publish-everywhere',
    title: 'Publish Everywhere (Search, Web, LinkedIn & Social)',
    bulbPopup:
      'Publish where your audience already is — from Google Search to your website, LinkedIn, and social channels',
    defaultExpanded: false,
    rows: [
      {
        id: 'google-search-console',
        label: 'Google Search Console',
        shortDescription: 'Connect search performance data to your SEO workflow',
        tooltip: 'See how content performs in Google Search and refine strategy with real data',
        cells: yes(),
      },
      {
        id: 'wix-publishing',
        label: 'Wix Publishing',
        shortDescription: 'Publish blog posts directly to Wix sites',
        tooltip: 'Skip copy-paste — push ALwrity content straight to Wix',
        cells: yes(),
      },
      {
        id: 'wordpress-publishing',
        label: 'WordPress Publishing',
        shortDescription: 'Publish to WordPress via API integration',
        tooltip: 'One-click publishing to your WordPress blog or site',
        cells: yes(),
      },
      {
        id: 'professional-platform',
        label: 'Professional Platform',
        shortDescription: 'LinkedIn Studio publishing to your professional profile or page',
        tooltip: 'Share LinkedIn-ready content from the same platform you used to create it',
        cells: yes(),
      },
      {
        id: 'social-platforms',
        label: 'Social Platforms',
        shortDescription: 'Facebook, Instagram, X, TikTok, and YouTube publishing',
        tooltip: 'Multi-platform social distribution from one content hub',
        cells: { free: 'dash', basic: 'dash', pro: 'yes', enterprise: 'yes' },
      },
    ],
    subgroups: [
      {
        id: 'publish-coming-soon',
        title: 'Coming soon features',
        defaultExpanded: false,
        rows: [
          {
            id: 'team-collaboration',
            label: 'Team Collaboration / roles',
            shortDescription: 'Invite teammates and assign roles',
            tooltip: 'Work together on content calendars, drafts, and approvals',
            cells: {
              free: 'coming_soon',
              basic: 'coming_soon',
              pro: 'coming_soon',
              enterprise: 'coming_soon',
            },
          },
          {
            id: 'custom-integrations',
            label: 'Custom Integrations / SSO',
            shortDescription: 'Enterprise SSO and custom CMS or martech hooks',
            tooltip: 'Connect ALwrity to your existing stack securely',
            cells: {
              free: 'coming_soon',
              basic: 'coming_soon',
              pro: 'coming_soon',
              enterprise: 'coming_soon',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'seo-analytics',
    title: 'SEO & Analytics Dashboards — Built In',
    bulbPopup:
      'Measure usage, SEO impact, ALwrity SEO statistics and Content performance in one place',
    defaultExpanded: false,
    rows: [
      {
        id: 'ai-usage-statistics',
        label: 'AI Usage Statistics',
        shortDescription: 'See how much AI you have used this month',
        tooltip:
          'Transparent usage meters so you always know where you stand against your plan limits',
        cells: yes(),
      },
      {
        id: 'seo-dashboard',
        label: 'SEO Dashboard and Analytics',
        shortDescription:
          'Keyword research, competitor insights, content research, optimization, SEO audit, internal linking, and analytics',
        tooltip: 'Your built-in SEO command center — no separate SEO subscription required',
        cells: yes(),
      },
      {
        id: 'content-planning',
        label: 'Content Planning Analytics',
        shortDescription: 'AI calendars, strategy views, and planning insights',
        tooltip: 'Plan what to publish and when, with data-backed recommendations',
        modalDetail: CONTENT_PLANNING_MODAL,
        cells: {
          free: 'starter',
          basic: 'standard',
          pro: 'advanced',
          enterprise: 'advanced',
        },
      },
      {
        id: 'advanced-analytics',
        label: 'Advanced Analytics & Insights',
        shortDescription: 'Deeper cross-channel and performance insights',
        tooltip: 'Go beyond basics with richer reporting for growth teams',
        cells: { free: 'dash', basic: 'dash', pro: 'yes', enterprise: 'yes' },
      },
      {
        id: 'white-label-reporting',
        label: 'White-label Reporting',
        shortDescription: 'Client-ready reports under your brand',
        tooltip: 'Present results to clients or stakeholders with your logo and colours',
        cells: { free: 'dash', basic: 'dash', pro: 'dash', enterprise: 'yes' },
      },
    ],
    subgroups: [
      {
        id: 'seo-coming-soon',
        title: 'Coming soon',
        defaultExpanded: false,
        rows: [
          {
            id: 'scheduler-analytics',
            label: 'Scheduler & Publish Analytics',
            shortDescription: 'Analytics for scheduled posts and publish performance',
            tooltip: 'Track what went live, when, and how it performed',
            cells: {
              free: 'coming_soon',
              basic: 'coming_soon',
              pro: 'coming_soon',
              enterprise: 'coming_soon',
            },
          },
        ],
      },
    ],
  },
  {
    id: 'brand-rewards',
    title: 'Brand Persona, Campaigns & Rewards',
    bulbPopup: 'Your brand voice, campaigns, and loyalty perks — built into every workflow',
    defaultExpanded: false,
    rows: [
      {
        id: 'campaign-creator',
        label: 'AI Campaign Creator (AI Marketing)',
        shortDescription: 'Product photoshoot, animation, video, and avatar campaigns',
        tooltip: 'Launch multi-asset marketing campaigns from one brief',
        cells: yes(),
      },
      {
        id: 'brand-persona',
        label: 'Meta Content / Brand Persona',
        shortDescription: 'Brand voice and persona from onboarding',
        tooltip:
          'ALwrity learns your tone so every tool sounds like you — set once during onboarding',
        cells: yes(),
      },
      {
        id: 'engagement-reward',
        label: 'Engagement Reward Matrix',
        shortDescription: 'Perks for publishing often and improving SEO',
        tooltip: 'Earn exclusive benefits when you create, publish, and grow with ALwrity',
        cells: { free: 'dash', basic: 'dash', pro: 'yes', enterprise: 'yes' },
      },
    ],
  },
  {
    id: 'support',
    title: 'Support that Scales With You',
    bulbPopup: 'From community help to dedicated enterprise support as you grow',
    defaultExpanded: false,
    rows: [
      {
        id: 'community-support',
        label: 'Community / standard Support',
        shortDescription: 'Help docs and community channels',
        tooltip: 'Get answers from guides and community resources',
        cells: yes(),
      },
      {
        id: 'priority-email',
        label: 'Priority Email Support',
        shortDescription: 'Faster email response for paid growth plans',
        tooltip: 'Direct priority line when you need help growing content operations',
        cells: { free: 'dash', basic: 'dash', pro: 'yes', enterprise: 'yes' },
      },
      {
        id: 'account-manager',
        label: 'Dedicated Account Manager',
        shortDescription: 'Named contact for enterprise accounts',
        tooltip: 'Strategic support for high-volume teams',
        cells: { free: 'dash', basic: 'dash', pro: 'dash', enterprise: 'yes' },
      },
      {
        id: 'white-glove-onboarding',
        label: 'Dedicated White-glove Onboarding',
        shortDescription: 'Guided setup for complex rollouts',
        tooltip: 'We help your team launch ALwrity the right way',
        cells: {
          free: 'dash',
          basic: 'dash',
          pro: 'contact_us',
          enterprise: 'yes',
        },
      },
      {
        id: 'white-label',
        label: 'White-label',
        shortDescription: 'ALwrity under your brand for clients',
        tooltip: 'Deliver AI marketing under your agency or company brand',
        cells: { free: 'dash', basic: 'dash', pro: 'dash', enterprise: 'yes' },
      },
    ],
  },
];

export interface LimitRowConfig {
  id: string;
  label: string;
  tooltip: string;
  apiField: keyof LimitFields;
  isCost?: boolean;
  /** Extra modal lines built from plan limits */
  modalExtra?: (limits: LimitFields, tier: PlanTier) => string | null;
}

export interface LimitFields {
  ai_text_generation_calls: number;
  stability_calls: number;
  image_edit_calls: number;
  video_calls: number;
  audio_calls: number;
  tavily_calls: number;
  serper_calls: number;
  exa_calls: number;
  metaphor_calls: number;
  firecrawl_calls: number;
  monthly_cost: number;
  _zero_means?: Record<string, 'disabled' | 'unlimited' | 'limited'>;
}

export const LIMITS_SECTION = {
  id: 'monthly-limits',
  title: 'Monthly AI Usage Limits',
  bulbPopup:
    'Fair monthly quotas that reset every billing cycle — all plans include automatic cost protection',
  defaultExpanded: true,
} as const;

/** Sections rendered before Monthly AI Usage Limits */
export const SECTIONS_BEFORE_LIMITS = PRICING_GRID_SECTIONS.slice(0, 2);

/** Sections rendered after Monthly AI Usage Limits */
export const SECTIONS_AFTER_LIMITS = PRICING_GRID_SECTIONS.slice(2);

export const LIMIT_ROWS: LimitRowConfig[] = [
  {
    id: 'ai-text',
    label: 'AI Text Generation',
    tooltip:
      'Total AI writing actions per month across all ALwrity writing tools — resets each billing cycle',
    apiField: 'ai_text_generation_calls',
  },
  {
    id: 'ai-image',
    label: 'AI Image Generation',
    tooltip: 'AI images created per month for posts, ads, and campaigns',
    apiField: 'stability_calls',
  },
  {
    id: 'ai-image-edits',
    label: 'AI Image edits',
    tooltip: 'Edits such as background removal, inpainting, and enhancements per month',
    apiField: 'image_edit_calls',
  },
  {
    id: 'ai-video',
    label: 'AI Video Generation',
    tooltip: 'AI video renders per month — includes shorts, avatars, and studio exports',
    apiField: 'video_calls',
  },
  {
    id: 'ai-audio',
    label: 'AI Audio Generation',
    tooltip: 'Voice generations and audio clips per month for podcasts and video',
    apiField: 'audio_calls',
  },
  {
    id: 'ai-search',
    label: 'AI Search Generation',
    tooltip: 'Fast web and search lookups while you research content ideas',
    apiField: 'tavily_calls',
    modalExtra: (limits, tier) => {
      const serper = limits.serper_calls;
      if (tier === 'free' && serper <= 0) return 'Free plan: primary search lookups only';
      if (serper > 0) {
        return `Also includes Google search API queries: ${serper} / month`;
      }
      return null;
    },
  },
  {
    id: 'ai-research-gen',
    label: 'AI Research Generation',
    tooltip: 'In-depth research passes for fact-checking and long-form content',
    apiField: 'exa_calls',
    modalExtra: (limits, tier) => {
      const parts: string[] = [];
      if (limits.metaphor_calls > 0) {
        parts.push(`Metaphor: ${limits.metaphor_calls} / month`);
      }
      if (limits.firecrawl_calls > 0) {
        parts.push(`Firecrawl: ${limits.firecrawl_calls} / month`);
      }
      if (parts.length === 0 && tier === 'free') {
        return 'Free plan: Exa only — Metaphor and Firecrawl not included';
      }
      if (parts.length > 0) {
        return `Also includes ${parts.join(' and ')}`;
      }
      return null;
    },
  },
  {
    id: 'monthly-cost-cap',
    label: 'Monthly Cost Cap',
    tooltip: 'Automatic spending limit to protect your account from overages',
    apiField: 'monthly_cost',
    isCost: true,
  },
];
