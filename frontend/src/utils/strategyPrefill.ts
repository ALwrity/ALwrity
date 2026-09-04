/**
 * Strategy prefill utilities for mapping onboarding data to strategy fields.
 * Phase 3: Auto-populate strategy builder from onboarding completion data.
 */

export interface OnboardingPersona {
  target_audience?: string;
  writing_style?: string;
  industry?: string;
  business_size?: string;
  goals?: string[];
}

export interface BrandAnalysis {
  business_type?: string;
  industry?: string;
  company_stage?: string;
}

export interface PerformanceMetrics {
  monthly_visitors?: number;
  conversion_rate?: number;
}

export interface WebsiteAnalysis {
  brand_analysis?: BrandAnalysis;
  performance_metrics?: PerformanceMetrics;
}

export interface SeoAudit {
  keywords?: string[];
  traffic_potential?: number;
  competition_level?: string;
}

export interface Competitor {
  name: string;
  strengths?: string[];
  weaknesses?: string[];
}

export interface CompetitorAnalysis {
  competitors?: Competitor[];
}

export interface OnboardingData {
  persona?: OnboardingPersona;
  website_analysis?: WebsiteAnalysis;
  seo_audit?: SeoAudit;
  competitor_analysis?: CompetitorAnalysis;
}

export interface QuickInputs {
  primary_goal?: 'traffic' | 'sales' | 'engagement' | 'brand';
  budget_range?: 'low' | 'medium' | 'high';
  timeline?: '3 months' | '6 months' | '12 months' | '24 months';
}

export interface StrategyPrefillInput {
  fromOnboarding: boolean;
  quickInputs?: QuickInputs;
}

export interface StrategyPrefillOutput {
  business_type?: string;
  industry?: string;
  target_audience?: string;
  content_pillars?: string[];
  competitors?: string[];
  primary_goal?: string;
  budget_range?: string;
  timeline?: string;
}

/**
 * Maps raw onboarding data to strategy fields.
 */
export function mapOnboardingToStrategy(data: OnboardingData): StrategyPrefillOutput {
  const result: StrategyPrefillOutput = {};

  // Map persona data
  if (data.persona) {
    if (data.persona.target_audience) {
      result.target_audience = data.persona.target_audience;
    }
  }

  // Map website analysis / brand data
  if (data.website_analysis?.brand_analysis) {
    if (data.website_analysis.brand_analysis.business_type) {
      result.business_type = data.website_analysis.brand_analysis.business_type;
    }
    if (data.website_analysis.brand_analysis.industry) {
      result.industry = data.website_analysis.brand_analysis.industry;
    }
  }

  // Map SEO audit keywords to content pillars
  if (data.seo_audit?.keywords && data.seo_audit.keywords.length > 0) {
    result.content_pillars = data.seo_audit.keywords.slice(0, 5);
  }

  // Map competitor names
  if (data.competitor_analysis?.competitors && data.competitor_analysis.competitors.length > 0) {
    result.competitors = data.competitor_analysis.competitors
      .map(c => c.name)
      .filter((name): name is string => Boolean(name));
  }

  return result;
}

/**
 * Main prefill function - combines onboarding data with quick inputs.
 */
export function strategyPrefill(
  onboardingData: OnboardingData,
  input: StrategyPrefillInput
): StrategyPrefillOutput {
  if (!input.fromOnboarding) {
    return {};
  }

  const result = mapOnboardingToStrategy(onboardingData);

  // Apply quick inputs with defaults
  const quickInputs = input.quickInputs || {};
  result.primary_goal = quickInputs.primary_goal || 'traffic';
  result.budget_range = quickInputs.budget_range || 'medium';
  result.timeline = quickInputs.timeline || '12 months';

  return result;
}

export default strategyPrefill;