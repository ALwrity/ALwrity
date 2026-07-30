/**
 * LinkedIn Studio — pricing feature definitions per plan.
 * 
 * Maps the backend plan limits (from plan_definitions.py / pricing.yaml) to
 * human-readable feature rows. Only Free and Basic tiers are surfaced.
 * 
 * Note: AI limits are shared across all ALwrity tools; in LinkedIn-only
 * deployments the full pool is available for LinkedIn Studio exclusively.
 */

export interface LinkedInPlanFeature {
  label: string;
  free: string;
  basic: string;
  tooltip?: string;
}

export const LINKEDIN_FEATURES: LinkedInPlanFeature[] = [
  {
    label: "AI Text Generation",
    free: "50 calls / month",
    basic: "500 calls / month",
    tooltip: "AI-powered posts, rewrites, comments, and content suggestions",
  },
  {
    label: "Profile Headshot (AI)",
    free: "5 edits / month",
    basic: "25 edits / month",
    tooltip: "Transform your photo into a professional LinkedIn headshot",
  },
  {
    label: "Video Posts (AI)",
    free: "2 videos / month",
    basic: "10 videos / month",
    tooltip: "Generate AI videos for LinkedIn posts",
  },
  {
    label: "Profile Optimization",
    free: "Included",
    basic: "Included",
    tooltip: "AI-powered profile analysis with optimization suggestions",
  },
  {
    label: "Post Analytics",
    free: "Included",
    basic: "Included",
    tooltip: "Track impressions, engagement, CTR, and follower growth over time",
  },
  {
    label: "Growth Engine",
    free: "Limited access",
    basic: "Full access",
    tooltip: "Trending topics, content gaps, network suggestions, and brand scorecard",
  },
  {
    label: "Topic Recommendations",
    free: "Included",
    basic: "Included",
    tooltip: "AI-powered topic ideas tailored to your industry and audience",
  },
  {
    label: "LinkedIn Accounts",
    free: "1 personal account",
    basic: "1 personal account",
    tooltip: "Connect your personal LinkedIn profile",
  },
  {
    label: "Priority Support",
    free: "Community",
    basic: "Email",
    tooltip: "Get help when you need it",
  },
];

export const LINKEDIN_PRICING_HERO = {
  title: "LinkedIn Studio Plans",
  subtitle: "Simple, transparent pricing to grow your LinkedIn presence. Start free, upgrade when you're ready.",
  plansTooltip: "All plans unlock LinkedIn Studio. Limits reset monthly. No hidden fees.",
};
