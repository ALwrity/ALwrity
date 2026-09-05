export interface StyleAnalysis {
  id?: number;
  guidelines?: {
    tone_recommendations?: string[];
    structure_guidelines?: string[];
    vocabulary_suggestions?: string[];
    engagement_tips?: string[];
    audience_considerations?: string[];
    brand_alignment?: string[];
    seo_optimization?: string[];
    conversion_optimization?: string[];
  } | null;
  writing_style?: {
    tone: string;
    voice: string;
    complexity: string;
    engagement_level: string;
    brand_personality?: string;
    formality_level?: string;
    emotional_appeal?: string;
  };
  content_characteristics?: {
    sentence_structure: string;
    vocabulary_level: string;
    paragraph_organization: string;
    content_flow: string;
    readability_score?: string;
    content_density?: string;
    visual_elements_usage?: string;
  };
  target_audience?: {
    demographics: string[];
    expertise_level: string;
    industry_focus: string;
    geographic_focus: string;
    psychographic_profile?: string;
    pain_points?: string[];
    motivations?: string[];
  };
  content_type?: {
    primary_type: string;
    secondary_types: string[];
    purpose: string;
    call_to_action: string;
    conversion_focus?: string;
    educational_value?: string;
  };
  brand_analysis?: {
    brand_voice: string;
    brand_values: string[];
    brand_positioning: string;
    competitive_differentiation: string;
    trust_signals: string[];
    authority_indicators: string[];
    brand_story?: string;
    unique_selling_propositions?: string[];
  };
  strategic_insights?: {
    content_strategy: string;
    competitive_advantages: string[];
    content_calendar_suggestions: string[];
    ai_generation_tips: string[];
  };
  content_strategy_insights?: any;
  style_guidelines?: any;
  style_patterns?: any;
  style_consistency?: string;
  unique_elements?: string[];
  seo_audit?: any;
  sitemap_analysis?: any;
  best_practices?: string[];
  avoid_elements?: string[];
  content_strategy?: string;
  competitive_advantages?: string[];
  content_calendar_suggestions?: string[];
  ai_generation_tips?: string[];
  content_templates?: Array<{type: string; headline: string; structure: string[]; tone_notes: string}>;
  headline_formulas?: Array<{pattern: string; example: string; category: string}>;
  content_briefs?: Array<{topic: string; target_keyword: string; target_audience: string; word_count: number; suggested_sections: string[]}>;
  competitive_angles?: Array<{angle: string; differentiator: string; headline_example: string}>;
  meta?: {
    confidence?: number;
    notes?: string;
    uncertainty?: any;
  };
  recommended_settings?: {
    writing_tone?: string;
    target_audience?: string;
    content_type?: string;
    creativity_level?: string;
    geographic_location?: string;
    industry_context?: string;
    brand_alignment?: string;
  };
}

export type DomainKey =
  | 'overview'
  | 'brand'
  | 'audience'
  | 'content'
  | 'seo'
  | 'sitemap'
  | 'footprint';

export type TabKey = 'insights' | 'guidelines' | 'refine_actions';

export interface UnifiedAnalysisContainerProps {
  // Identical contract to AnalysisResultsDisplay
  analysis: StyleAnalysis;
  domainName: string;
  useAnalysisForGenAI?: boolean;
  onUseAnalysisChange?: (use: boolean) => void;
  crawlResult?: any;
  onAnalysisUpdate?: (updatedAnalysis: StyleAnalysis) => void;
  warning?: string;
  onSave?: () => void;
  // New: optional starting position
  defaultDomain?: DomainKey;
  defaultTab?: TabKey;
  hideOuterCard?: boolean;
}

export interface DomainConfig {
  key: DomainKey;
  label: string;
  tooltip: string;
  /** Returns a number badge (e.g. issue count), or undefined for no badge */
  getBadge?: (analysis: StyleAnalysis) => number | undefined;
  /** True when there is any data to display for this domain */
  hasData: (analysis: StyleAnalysis, crawlResult: any) => boolean;
}

// Correspondence mapping between horizontal tabs and vertical domains (all constant now)
export const TAB_CORRESPONDING_DOMAINS: Record<TabKey, DomainKey[]> = {
  insights: ['overview', 'brand', 'audience', 'content', 'seo', 'sitemap', 'footprint'],
  guidelines: ['overview', 'brand', 'audience', 'content', 'seo', 'sitemap'], // Added sitemap
  refine_actions: ['overview', 'brand', 'audience', 'content', 'footprint'], // Added footprint
};
