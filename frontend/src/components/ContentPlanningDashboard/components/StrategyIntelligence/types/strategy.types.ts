export interface StrategyMetadata {
  generated_at?: string;
  generation_timestamp?: string;
  user_id: number;
  strategy_name: string;
  generation_version?: string;
  ai_model?: string;
  personalization_level?: string;
  grounding_status?: 'validated' | 'partial' | 'error' | string;
  grounding_validation?: {
    passed: boolean;
    score: number;
    status?: string;
    violations?: string[];
    error?: string;
  };
  ai_generated: boolean;
  comprehensive: boolean;
  content_calendar_ready: boolean;
}

export interface StrategicInsights {
  market_positioning?: {
    positioning_strength: number;
    current_position: string;
    swot_analysis?: {
      strengths: string[];
      opportunities: string[];
    };
  };
  content_opportunities?: string[];
  growth_potential?: {
    market_size: string;
    growth_rate: string;
    key_drivers?: string[];
    competitive_advantages?: string[];
  };
  swot_summary?: {
    overall_score: number;
    primary_strengths: string[];
    key_opportunities: string[];
  };
  // Backend insights array structure
  insights?: Array<{
    type: string;
    insight: string;
    confidence_level: string;
    estimated_impact: string;
    implementation_time: string;
    priority: string;
    reasoning: string;
  }>;
}

export interface CompetitiveAnalysis {
  competitors?: Array<{
    name: string;
    market_position: string;
    strengths: string[];
    weaknesses: string[];
    content_strategy?: string; // Added to match backend
    competitive_response?: string;
  }>;
  market_gaps?: string[];
  opportunities?: string[]; // Added to match backend
  recommendations?: string[]; // Added to match backend
  competitive_advantages?: {
    primary: string[];
    sustainable: string[];
    development_areas: string[];
  };
  swot_competitive_insights?: {
    leverage_strengths: string[];
    address_weaknesses: string[];
    capitalize_opportunities: string[];
    mitigate_threats: string[];
  };
}

export interface PerformancePredictions {
  estimated_roi?: string;
  success_probability?: string;
  traffic_growth?: {
    month_3?: string;
    month_6?: string;
    month_12?: string;
  };
  engagement_metrics?: {
    bounce_rate?: string;
    social_shares?: string;
    time_on_page?: string;
  };
  conversion_predictions?: {
    content_downloads?: string;
    email_signups?: string;
    lead_generation?: string;
  };
  key_metrics?: {
    engagement_rate?: string;
    conversion_rate?: string;
    reach_growth?: string;
    brand_awareness?: string;
    market_share?: string;
  };
  timeline_projections?: {
    [key: string]: string;
  };
  success_factors?: {
    primary: string[];
    secondary: string[];
    risk_mitigation: string[];
  };
  swot_based_predictions?: {
    strength_impact: string;
    opportunity_impact: string;
    weakness_mitigation: string;
    threat_management: string;
  };
  // Legacy nested prediction objects (keeping for backward compatibility)
  traffic_predictions?: {
    monthly_traffic?: string;
    growth_rate?: string;
    traffic_growth?: string;
    month_1?: string;
  };
  engagement_predictions?: {
    engagement_rate?: string;
    brand_awareness?: string;
    time_on_page?: string;
    month_3?: string;
    success_factors?: string[];
  };
  conversion_predictions_legacy?: {
    conversion_rate?: string;
    lead_generation?: string;
    month_6?: string;
    risk_mitigation?: string[];
  };
  roi_predictions?: {
    estimated_roi?: string;
    market_share?: string;
    cost_benefit?: string;
    success_factors?: string[];
  };
}

export interface ImplementationRoadmap {
  total_duration?: string;
  timeline?: string;
  phases?: Array<{
    phase: string;
    duration: string;
    tasks: string[]; // Changed from activities to match backend
    milestones: string[]; // Changed from deliverables to match backend
    resources: string[]; // Added to match backend
    swot_focus?: string;
  }>;
  milestones?: string[]; // Added to match backend data
  resource_requirements?: string[]; // Added to match backend data
  critical_path?: string[]; // Added to match backend data
  success_metrics?: string[]; // Added to match backend
  resource_allocation?: {
    team_members?: string[]; // Changed from team_requirements to match backend
    team_requirements?: string[]; // Added to match backend data
    budget_allocation?: {
      total_budget?: string;
      content_creation?: string;
      technology_tools?: string;
      marketing_promotion?: string;
      external_resources?: string;
    };
    swot_priorities?: {
      high_priority: string[];
      medium_priority: string[];
      low_priority: string[];
    };
  };
  timeline_object?: {
    start_date?: string;
    end_date?: string;
    key_milestones?: string[];
  }; // Added to match backend
  swot_integration?: {
    strength_leverage: string[];
    weakness_improvement: string[];
    opportunity_capitalization: string[];
    threat_mitigation: string[];
  };
}

export interface RiskAssessment {
  overall_risk_level?: string;
  risks?: Array<{
    risk: string;
    probability: string;
    impact: string;
    mitigation?: string;
    contingency?: string;
  }>;
  risk_categories?: {
    market_risks?: Array<{
      risk: string;
      probability: string;
      impact: string;
      mitigation?: string;
    }>;
    operational_risks?: Array<{
      risk: string;
      probability: string;
      impact: string;
      mitigation?: string;
    }>;
    competitive_risks?: Array<{
      risk: string;
      probability: string;
      impact: string;
      mitigation?: string;
    }>;
    technical_risks?: Array<{
      risk: string;
      probability: string;
      impact: string;
      mitigation?: string;
    }>;
    financial_risks?: Array<{
      risk: string;
      probability: string;
      impact: string;
      mitigation?: string;
    }>;
  };
  monitoring_framework?: {
    escalation_procedures?: string[];
    key_indicators?: string[];
    monitoring_frequency?: string;
    review_schedule?: string;
  };
  swot_risk_mapping?: {
    strength_risks: string;
    weakness_risks: string;
    opportunity_risks: string;
    threat_risks: string;
  };
  risk_mitigation_strategies?: {
    based_on_strengths: string;
    based_on_opportunities: string;
    based_on_weaknesses: string;
    based_on_threats: string;
  };
  mitigation_strategies?: string[];
}

export interface StrategySummary {
  estimated_roi: string;
  implementation_timeline: string;
  risk_level: string;
  success_probability: string;
  next_step: string;
  swot_highlights?: {
    key_strengths: string[];
    key_opportunities: string[];
    primary_risks: string[];
  };
}

export interface StrategyData {
  strategy_metadata?: StrategyMetadata;
  metadata?: StrategyMetadata;
  base_strategy?: any;
  strategic_insights?: StrategicInsights;
  competitive_analysis?: CompetitiveAnalysis;
  performance_predictions?: PerformancePredictions;
  implementation_roadmap?: ImplementationRoadmap;
  risk_assessment?: RiskAssessment;
  summary?: StrategySummary;
}

export interface StrategyActionsProps {
  strategyData: StrategyData | null;
  strategyConfirmed: boolean;
  onConfirmStrategy: () => void;
  onGenerateContentCalendar: () => void;
  onRefreshData: () => void;
}

export interface StrategyCardProps {
  strategyData: StrategyData | null;
  loading?: boolean;
}

export interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
} 