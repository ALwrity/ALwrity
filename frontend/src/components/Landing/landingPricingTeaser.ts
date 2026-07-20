/**
 * Landing page pricing teaser — aligned with backend default plans
 * (see backend/services/subscription/pricing_service.py initialize_default_plans)
 * and frontend/src/components/Pricing/pricingGridReference.ts
 */

export type LandingPricingTeaserPlan = {
  name: string;
  price: string;
  period: string;
  highlight: boolean;
  features: readonly string[];
  ctaLabel: string;
  /** Shorter label for mobile compact row (falls back to ctaLabel) */
  mobileCtaLabel?: string;
  /** free → sign-in; others → /pricing */
  ctaAction: 'signin' | 'pricing';
};

export const LANDING_PRICING_TEASER_PLANS: readonly LandingPricingTeaserPlan[] = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    highlight: false,
    ctaLabel: 'Start free',
    ctaAction: 'signin',
    features: [
      '50 AI text generations / month',
      'Basic content generation',
      'Limited web research (10 searches / mo)',
      '2 AI videos / month',
      'Community support',
    ],
  },
  {
    name: 'Basic',
    price: '$29',
    period: '/mo',
    highlight: true,
    ctaLabel: 'See Basic plan →',
    mobileCtaLabel: 'Basic →',
    ctaAction: 'pricing',
    features: [
      '500 AI text generations / month',
      'All ALwrity tools & OSS model priority',
      'Advanced research & basic analytics',
      'Multi-platform publishing',
      'Priority email support',
    ],
  },
  {
    name: 'Pro',
    price: '$79',
    period: '/mo',
    highlight: false,
    ctaLabel: 'See Pro plan →',
    mobileCtaLabel: 'Pro →',
    ctaAction: 'pricing',
    features: [
      '3,000 AI text generations / month',
      'Premium research & advanced analytics',
      'Scheduler & remarketing tools',
      'Team collaboration features',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: '$199',
    period: '/mo',
    highlight: false,
    ctaLabel: 'See Enterprise plan →',
    mobileCtaLabel: 'Enterprise →',
    ctaAction: 'pricing',
    features: [
      'Unlimited AI usage (fair use)',
      'Dedicated account manager',
      'Custom integrations & SSO',
      'SLA & enterprise security',
      'White-glove onboarding',
    ],
  },
] as const;
