import type { Competitor } from '../WebsiteStep/components';
import type { ContentPillarData } from './ContentPillarsSection';

export interface ResearchStepDashboardProps {
  competitors: Competitor[];
  contentPillars: ContentPillarData | null;
  isLoadingPillars: boolean;
  pillarsError?: string | null;
  benchmarkReport: unknown;
  isRunningBenchmark: boolean;
  sitemapAnalysis: unknown;
  isAnalyzingSitemap: boolean;
  onShowHighlights: (competitor: Competitor) => void;
  onRemoveCompetitor: (index: number) => void;
  onAddCompetitor: (competitor: Competitor) => void;
  onRefreshPillars: () => void | Promise<void>;
  onRunBenchmark: () => void | Promise<void>;
  onRefreshStrategy: () => void | Promise<void>;
  onShowBenchmarks: () => void;
  onShowStrategy: () => void;
  onShowPublishing: () => void;
  onShowStructure: () => void;
  onOpenBackgroundSetup: () => void;
}
