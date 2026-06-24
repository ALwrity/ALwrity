/**
 * Backend-aligned pricing grid reference (Free & Basic) for future comparison-grid build.
 * Source: backend/services/subscription/pricing_service.py initialize_default_plans()
 *         backend/api/subscription/utils.py format_plan_limits()
 *
 * UI showcase rules:
 * - All ALwrity tools: show ✓ for Free & Basic (all_tools_access on Basic; marketing H3 applies to all tiers)
 * - Platform integrations: Basic should show ✓ (PlanCard.tsx incorrectly hid these from Basic — fix in grid)
 * - Monthly limits: use ai_text_generation_calls when present; 0 + zero_means=disabled → "Not included"
 * - wavespeed_calls 0 on Free = unlimited per backend comment, but video_calls_limit (2) is the real video cap
 */

export const FREE_PLAN_BACKEND = {
  tier: 'free',
  price_monthly: 0,
  price_yearly: 0,
  description: 'Perfect for trying out ALwrity',
  features: ['basic_content_generation', 'limited_research'],
  limits: {
    ai_text_generation_calls: 50,
    gemini_calls: 50,
    openai_calls: 0,
    anthropic_calls: 0,
    mistral_calls: 0,
    tavily_calls: 10,
    serper_calls: 10,
    stability_calls: 10,
    exa_calls: 10,
    video_calls: 2,
    image_edit_calls: 5,
    audio_calls: 10,
    wavespeed_calls: 0,
    monthly_cost: 2,
  },
  zero_means_disabled: [
    'openai_calls',
    'anthropic_calls',
    'mistral_calls',
    'metaphor_calls',
    'firecrawl_calls',
  ],
} as const;

export const BASIC_PLAN_BACKEND = {
  tier: 'basic',
  price_monthly: 29,
  price_yearly: 290,
  description:
    'Perfect for individuals and small teams. Access all ALwrity features with generous limits powered by OSS AI models.',
  features: [
    'full_content_generation',
    'advanced_research',
    'basic_analytics',
    'all_tools_access',
    'oss_models_priority',
  ],
  limits: {
    ai_text_generation_calls: 500,
    gemini_calls: 1000,
    openai_calls: 500,
    anthropic_calls: 200,
    mistral_calls: 500,
    tavily_calls: 200,
    serper_calls: 200,
    metaphor_calls: 100,
    firecrawl_calls: 100,
    stability_calls: 25,
    exa_calls: 100,
    video_calls: 10,
    image_edit_calls: 25,
    audio_calls: 100,
    wavespeed_calls: 200,
    monthly_cost: 25,
  },
} as const;

/** Suggested grid rows for Monthly Usage Limits section (pending TC 16 approval) */
export const SUGGESTED_LIMIT_ROWS = [
  { key: 'ai_text_generation_calls', label: 'AI Text Generations' },
  { key: 'stability_calls', label: 'AI Images' },
  { key: 'image_edit_calls', label: 'Image Edits' },
  { key: 'video_calls', label: 'AI Videos' },
  { key: 'audio_calls', label: 'Audio Generations' },
  { key: 'tavily_calls', label: 'Research Searches (Tavily)' },
  { key: 'exa_calls', label: 'Exa AI Searches' },
  { key: 'wavespeed_calls', label: 'WaveSpeed AI Calls' },
  { key: 'monthly_cost', label: 'Monthly Cost Cap' },
] as const;

export function formatLimitDisplay(
  value: number,
  zeroMeans?: 'disabled' | 'unlimited' | 'limited',
  isCost = false
): string {
  if (isCost && value > 0) return `$${value}`;
  if (value === 0 && zeroMeans === 'unlimited') return 'Unlimited';
  if (value === 0) return '—';
  return `${value} / month`;
}

export function formatCostCap(value: number): string {
  return `$${value}`;
}
