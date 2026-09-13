import React from 'react';
import { Box } from '@mui/material';
import { SifIndexingPanel } from '../common/SifIndexingPanel';
import { BenchmarkInsightsSection } from './BenchmarkInsightsSection';
import { StrategicInsightsSection } from './StrategicInsightsSection';
import type { ResearchStepDashboardProps } from './researchStepDashboardTypes';

export const ResearchStepLegacyStack: React.FC<ResearchStepDashboardProps> = ({
  competitors,
  benchmarkReport,
  isRunningBenchmark,
  sitemapAnalysis,
  isAnalyzingSitemap,
  onRunBenchmark,
  onRefreshStrategy,
  onShowBenchmarks,
  onShowStrategy,
  onShowPublishing,
  onShowStructure,
}) => (
  <Box data-testid="research-legacy-stack" sx={{ mt: 4, pt: 3, borderTop: '2px dashed #E2E8F0' }}>
    <Box mt={0} mb={3}>
      <BenchmarkInsightsSection
        report={benchmarkReport}
        onRefresh={onRunBenchmark}
        isRefreshing={isRunningBenchmark}
      />
    </Box>

    {competitors.length > 0 && (
      <StrategicInsightsSection
        sitemapAnalysis={sitemapAnalysis}
        isAnalyzingSitemap={isAnalyzingSitemap}
        onRefreshStrategy={onRefreshStrategy}
        onShowBenchmarks={onShowBenchmarks}
        onShowStrategy={onShowStrategy}
        onShowPublishing={onShowPublishing}
        onShowStructure={onShowStructure}
      />
    )}

    <SifIndexingPanel />
  </Box>
);
