import React from 'react';
import { Box } from '@mui/material';
import { SifIndexingPanel } from '../common/SifIndexingPanel';
import { BenchmarkInsightsSection } from './BenchmarkInsightsSection';
import type { ResearchStepDashboardProps } from './researchStepDashboardTypes';

/**
 * Legacy QA stack below the unified dashboard (dashed border).
 * Strategic Content Opportunities lives only in unified Tab 2 — not duplicated here.
 */
export const ResearchStepLegacyStack: React.FC<ResearchStepDashboardProps> = ({
  benchmarkReport,
  isRunningBenchmark,
  onRunBenchmark,
}) => (
  <Box data-testid="research-legacy-stack" sx={{ mt: 4, pt: 3, borderTop: '2px dashed #E2E8F0' }}>
    <Box mt={0} mb={3}>
      <BenchmarkInsightsSection
        report={benchmarkReport}
        onRefresh={onRunBenchmark}
        isRefreshing={isRunningBenchmark}
      />
    </Box>

    <SifIndexingPanel />
  </Box>
);
