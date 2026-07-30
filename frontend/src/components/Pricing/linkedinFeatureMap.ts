/**
 * LinkedIn Studio — pricing feature definitions per plan.
 * 
 * Maps the backend plan limits (from SubscriptionPlan.limits) to
 * human-readable feature rows shown on the LinkedIn pricing page.
 * Only Free and Basic tiers are surfaced; Pro/Enterprise are gated.
 */

export interface LinkedInPlanFeature {
  label: string;
  free: string;
  basic: string;
  tooltip?: string;
}

export const LINKEDIN_FEATURES: LinkedInPlanFeature[] = [
  {
    label: "AI-Generated Posts",
    free: "5 / month",
    basic: "50 / month",
    tooltip: "Full LinkedIn posts with research grounding, citations, and quality analysis",
  },
  {
    label: "Profile Optimization",
    free: "Basic suggestions",
    basic: "AI-powered analysis + suggestions",
    tooltip: "Analyze and improve your LinkedIn profile with AI recommendations",
  },
  {
    label: "AI Profile Headshot",
    free: "—",
    basic: "5 / month",
    tooltip: "Transform your photo into a professional LinkedIn headshot",
  },
  {
    label: "Post Analytics",
    free: "Last 7 days",
    basic: "Last 30 days",
    tooltip: "Track impressions, engagement, CTR, and follower growth",
  },
  {
    label: "Growth Engine",
    free: "—",
    basic: "3 trending topics / month",
    tooltip: "Discover trending topics, content gaps, and network suggestions",
  },
  {
    label: "Topic Recommendations",
    free: "—",
    basic: "10 / month",
    tooltip: "AI-powered topic ideas tailored to your industry and audience",
  },
  {
    label: "Post Scheduling",
    free: "—",
    basic: "Included",
    tooltip: "Schedule posts for optimal LinkedIn engagement times",
  },
  {
    label: "LinkedIn Accounts",
    free: "1 account",
    basic: "1 account",
    tooltip: "Connect your personal LinkedIn profile",
  },
  {
    label: "Video Posts",
    free: "—",
    basic: "2 / month",
    tooltip: "Generate AI videos for LinkedIn posts",
  },
  {
    label: "Priority Support",
    free: "Community",
    basic: "Email support",
    tooltip: "Get help when you need it",
  },
];

export const LINKEDIN_PRICING_HERO = {
  title: "LinkedIn Studio Plans",
  subtitle: "Simple, transparent pricing to grow your LinkedIn presence. Start free, upgrade when you're ready.",
  plansTooltip: "All plans unlock LinkedIn Studio. Limits reset monthly. No hidden fees.",
};
