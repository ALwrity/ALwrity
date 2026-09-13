// SEO Dashboard Components Index
// Export all SEO CopilotKit components for easy importing

// Core CopilotKit Components
export { default as SEOCopilotKitProvider } from './SEOCopilotKitProvider';
export { default as SEOCopilotContext } from './SEOCopilotContext';
export { default as SEOCopilotActions } from './SEOCopilotActions';
export { default as SEOCopilotSuggestions } from './SEOCopilotSuggestions';
export { default as SEOCopilot } from './SEOCopilot';

// Store and Services
export { useSEOCopilotStore, useSEOCopilotAnalysis, useSEOCopilotSuggestions, useSEOCopilotDashboard } from '../../stores/seoCopilotStore';
export { default as seoApiService } from '../../services/seoApiService';

// AI Overview Insights
export { AIVisibilitySection } from './components/AIVisibilitySection';

// Types
export type {
  SEOAnalysisData,
  SEOIssue,
  TrafficMetrics,
  RankingData,
  SpeedMetrics,
  KeywordData,
  UserProfile,
  PersonalizationData,
  CopilotActionParams,
  CopilotActionResponse,
  MetaDescriptionResponse,
  PageSpeedResponse,
  SitemapResponse,
  ChartConfig,
  DashboardLayout,
  SEOCopilotState,
  CopilotSuggestion,
  SEOApiService,
  SEOActionError,
  SEOCategory,
  SEOExperienceLevel,
  BusinessType,
  TimeRange,
  ChartType
} from '../../types/seoCopilotTypes';
