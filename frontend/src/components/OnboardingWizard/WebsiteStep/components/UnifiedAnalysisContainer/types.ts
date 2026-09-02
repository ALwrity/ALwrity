import type { StyleAnalysis } from '../AnalysisResultsDisplay';

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
