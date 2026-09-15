import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ResearchStepLegacyStack } from '../ResearchStepLegacyStack';
import type { ResearchStepDashboardProps } from '../researchStepDashboardTypes';

vi.mock('../../common/SifIndexingPanel', () => ({
  SifIndexingPanel: () => <div data-testid="sif-indexing-panel">SIF</div>,
}));

vi.mock('../BenchmarkInsightsSection', () => ({
  BenchmarkInsightsSection: () => <div data-testid="benchmark-insights">Benchmark</div>,
}));

vi.mock('../StrategicInsightsSection', () => ({
  StrategicInsightsSection: () => <div data-testid="strategic-insights">Strategic</div>,
}));

const theme = createTheme();

const baseProps: ResearchStepDashboardProps = {
  competitors: [
    {
      url: 'https://a.com',
      domain: 'a.com',
      title: 'A',
      summary: '',
      relevance_score: 0.9,
      competitive_insights: { business_model: '', target_audience: '' },
      content_insights: { content_focus: '', content_quality: '' },
    },
  ],
  contentPillars: null,
  isLoadingPillars: false,
  pillarsError: null,
  benchmarkReport: null,
  isRunningBenchmark: false,
  sitemapAnalysis: { analysis_data: { onboarding_insights: {} } },
  isAnalyzingSitemap: false,
  onShowHighlights: vi.fn(),
  onRemoveCompetitor: vi.fn(),
  onAddCompetitor: vi.fn(),
  onRefreshPillars: vi.fn(),
  onRunBenchmark: vi.fn(),
  onRefreshStrategy: vi.fn(),
  onShowBenchmarks: vi.fn(),
  onShowStrategy: vi.fn(),
  onShowPublishing: vi.fn(),
  onShowStructure: vi.fn(),
};

describe('ResearchStepLegacyStack', () => {
  it('renders legacy QA stack with benchmark and SIF only', () => {
    render(
      <ThemeProvider theme={theme}>
        <ResearchStepLegacyStack {...baseProps} />
      </ThemeProvider>
    );

    expect(screen.getByTestId('research-legacy-stack')).toBeInTheDocument();
    expect(screen.getByTestId('benchmark-insights')).toBeInTheDocument();
    expect(screen.getByTestId('sif-indexing-panel')).toBeInTheDocument();
  });

  it('does not duplicate Strategic Content Opportunities in the legacy stack', () => {
    render(
      <ThemeProvider theme={theme}>
        <ResearchStepLegacyStack {...baseProps} />
      </ThemeProvider>
    );

    expect(screen.queryByTestId('strategic-insights')).not.toBeInTheDocument();
  });
});
