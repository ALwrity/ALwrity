export interface SubscriptionPlan {
  id: number;
  name: string;
  tier: string;
  price_monthly: number;
  price_yearly: number;
  description: string;
  features: string[];
  limits: {
    gemini_calls: number;
    openai_calls: number;
    anthropic_calls: number;
    mistral_calls: number;
    tavily_calls: number;
    serper_calls: number;
    metaphor_calls: number;
    firecrawl_calls: number;
    stability_calls: number;
    monthly_cost: number;
    image_edit_calls?: number;
    video_calls?: number;
    audio_calls?: number;
    ai_text_generation_calls_limit?: number;
    ai_text_generation_calls?: number;
    exa_calls?: number;
    wavespeed_calls?: number;
    _zero_means?: Record<string, 'disabled' | 'unlimited' | 'limited'>;
  };
}
