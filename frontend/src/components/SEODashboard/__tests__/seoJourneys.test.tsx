import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SEOAnalysisController } from '../SEOAnalysisController';
import { enterpriseSeoAPI } from '../../../api/enterpriseSeoApi';

vi.mock('../../../api/enterpriseSeoApi', () => ({
  enterpriseSeoAPI: {
    executeEnterpriseAudit: vi.fn(),
    analyzeGSCSearchPerformance: vi.fn(),
  },
}));

// GSC OAuth hook inside results tree: never fires network in tests.
vi.mock('../../../hooks/useAIVisibilityInsights', () => ({
  useAIVisibilityInsights: () => ({
    loading: false,
    error: null,
    result: null,
    thresholds: {},
    runAnalysis: vi.fn(),
    setThreshold: vi.fn(),
    resetThresholds: vi.fn(),
    reset: vi.fn(),
  }),
}));

const AUDIT = {
  website_url: 'https://example.com',
  audit_date: '2026-01-01',
  executive_summary: {
    overall_score: 82,
    estimated_traffic_potential: '+40%',
    timeframe_to_implement: '6 weeks',
    critical_issues: ['Missing titles'],
    key_findings: ['Good structure'],
    top_opportunities: ['Meta descriptions'],
  },
  technical_audit: {
    pages_audited: 10,
    avg_score: 78,
    issues: [],
    core_web_vitals: {},
  },
  implementation_roadmap: { phase1_quick_wins: [], phase2_medium_term: [], phase3_long_term: [] },
};

const GSC = {
  site_url: 'https://example.com',
  analysis_date: '2026-01-01',
  analysis_period_days: 90,
  performance_overview: {
    clicks: 1200,
    impressions: 30000,
    ctr: 0.04,
    avg_position: 8.5,
    top_keywords: [],
    traffic_trend: 'up',
  },
  keyword_analysis: { top_performers: [], opportunities: [], declining_keywords: [] },
  content_opportunities: [],
  traffic_potential: {
    low_hanging_fruit: 'x',
    medium_term_opportunities: 'y',
    long_term_growth: 'z',
  },
  technical_signals: {
    core_web_vitals_score: 90,
    mobile_usability_issues: 0,
    indexing_issues: 0,
    security_issues: 0,
  },
};

function startAudit(url = 'https://example.com') {
  fireEvent.change(screen.getByLabelText(/website url/i), {
    target: { value: url },
  });
  // Re-query after the change: the click target must be a live DOM node.
  const button = screen.getByRole('button', {
    name: /start analysis|running/i,
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
}

describe('Phase 6 — enterprise audit journeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path: audit + GSC complete, Review step and results render', async () => {
    vi.mocked(enterpriseSeoAPI.executeEnterpriseAudit).mockResolvedValue({
      success: true,
      message: 'ok',
      data: AUDIT,
    } as any);
    vi.mocked(enterpriseSeoAPI.analyzeGSCSearchPerformance).mockResolvedValue({
      success: true,
      message: 'ok',
      data: GSC,
    } as any);

    render(<SEOAnalysisController />);
    startAudit();

    // Stepper reaches Review and both result sets render (fail fast if any crash).
    await waitFor(() => {
      expect(screen.getByText('Review')).toBeInTheDocument();
    });
    expect(screen.getByText(/Audit Score: 82/)).toBeInTheDocument();
    expect(screen.getByText(/Clicks: 1,200/)).toBeInTheDocument();
  });

  it('outage path: audit failure surfaces an error Alert, no results', async () => {
    vi.mocked(enterpriseSeoAPI.executeEnterpriseAudit).mockRejectedValue(
      new Error('Backend unavailable'),
    );

    render(<SEOAnalysisController />);
    startAudit();

    await waitFor(() => {
      expect(screen.getByText('Backend unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Audit Score:/)).toBeNull();
  });

  it('validation path: invalid URL is rejected before any network call', () => {
    render(<SEOAnalysisController />);
    fireEvent.change(screen.getByLabelText(/website url/i), {
      target: { value: 'not-a-url' },
    });
    fireEvent.click(screen.getByRole('button', { name: /start analysis/i }));
    expect(enterpriseSeoAPI.executeEnterpriseAudit).not.toHaveBeenCalled();
    expect(screen.getByText(/valid website url/i)).toBeInTheDocument();
  });
});
