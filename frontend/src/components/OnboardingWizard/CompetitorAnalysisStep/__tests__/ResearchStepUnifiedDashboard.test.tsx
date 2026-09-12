import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ResearchStepUnifiedDashboard } from '../ResearchStepUnifiedDashboard';
import type { ResearchStepDashboardProps } from '../researchStepDashboardTypes';

vi.mock('../../WebsiteStep/components', () => ({
  CompetitorsGrid: () => <div data-testid="competitors-grid">Competitors</div>,
}));

vi.mock('../../common/SifIndexingPanel', () => ({
  SifIndexingPanel: () => <div data-testid="sif-indexing-panel">SIF</div>,
}));

vi.mock('../ContentPillarsSection', () => ({
  ContentPillarsSection: () => <div data-testid="content-pillars">Pillars</div>,
}));

vi.mock('../BenchmarkInsightsSection', () => ({
  BenchmarkInsightsSection: () => <div data-testid="benchmark-insights">Benchmark</div>,
}));

vi.mock('../StrategicInsightsSection', () => ({
  StrategicInsightsSection: () => <div data-testid="strategic-insights">Strategic</div>,
}));

const theme = createTheme();

const baseProps: ResearchStepDashboardProps = {
  competitors: [{ url: 'https://a.com', domain: 'a.com', title: 'A', summary: '', relevance_score: 0.9, competitive_insights: { business_model: '', target_audience: '' }, content_insights: { content_focus: '', content_quality: '' } }],
  contentPillars: null,
  isLoadingPillars: false,
  pillarsError: null,
  benchmarkReport: null,
  isRunningBenchmark: false,
  sitemapAnalysis: null,
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
  onOpenBackgroundSetup: vi.fn(),
};

function renderDashboard(overrides: Partial<ResearchStepDashboardProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ResearchStepUnifiedDashboard {...baseProps} {...overrides} />
    </ThemeProvider>
  );
}

describe('ResearchStepUnifiedDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders unified dashboard with three main folder tabs', () => {
    renderDashboard();
    expect(screen.getByTestId('research-unified-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Competitive Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Strategic Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Smart Background Setup')).toBeInTheDocument();
  });

  it('shows Discovered Competitors by default on Tab 1', () => {
    renderDashboard();
    expect(screen.getByTestId('competitors-grid')).toBeInTheDocument();
  });

  it('switches to Content Pillars sub-tab', () => {
    renderDashboard();
    const subtabs = screen.getByTestId('research-vertical-subtabs');
    fireEvent.click(within(subtabs).getByText('Content Pillars'));
    expect(screen.getByTestId('content-pillars')).toBeInTheDocument();
  });

  it('switches to Benchmark Insights sub-tab', () => {
    renderDashboard();
    const subtabs = screen.getByTestId('research-vertical-subtabs');
    fireEvent.click(within(subtabs).getByText('Benchmark Insights'));
    expect(screen.getByTestId('benchmark-insights')).toBeInTheDocument();
  });

  it('shows strategic empty state when no competitors on Tab 2', () => {
    renderDashboard({ competitors: [] });
    fireEvent.click(screen.getByText('Strategic Opportunities'));
    expect(
      screen.getByText(/Discover competitors first to unlock strategic content opportunities/i)
    ).toBeInTheDocument();
  });

  it('shows Strategic Content Opportunities when competitors exist', () => {
    renderDashboard();
    fireEvent.click(screen.getByText('Strategic Opportunities'));
    expect(screen.getByTestId('strategic-insights')).toBeInTheDocument();
  });

  it('shows SIF Indexing sub-tab on Tab 2', () => {
    renderDashboard();
    fireEvent.click(screen.getByText('Strategic Opportunities'));
    const subtabs = screen.getAllByTestId('research-vertical-subtabs')[0];
    fireEvent.click(within(subtabs).getByText('SIF Indexing'));
    expect(screen.getByTestId('sif-indexing-panel')).toBeInTheDocument();
  });

  it('opens background setup from Tab 3', () => {
    const onOpenBackgroundSetup = vi.fn();
    renderDashboard({ onOpenBackgroundSetup });
    fireEvent.click(screen.getByText('Smart Background Setup'));
    fireEvent.click(screen.getByRole('button', { name: /Open Smart Background Setup/i }));
    expect(onOpenBackgroundSetup).toHaveBeenCalledTimes(1);
  });

  it('does not mount ProgressModal inside dashboard', () => {
    renderDashboard();
    expect(screen.queryByText(/Analyzing Your Competition/i)).not.toBeInTheDocument();
  });
});
