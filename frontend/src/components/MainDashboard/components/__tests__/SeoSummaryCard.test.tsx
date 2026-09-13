import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import SeoSummaryCard from '../SeoSummaryCard';
import { apiClient } from '../../../../api/client';

vi.mock('../../../../api/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const HERE = dirname(fileURLToPath(import.meta.url));

const mockGet = () => apiClient.get as unknown as ReturnType<typeof vi.fn>;

const CARD = {
  status: 'ok',
  has_data: true,
  website_url: 'https://example.com',
  platform_connections: {
    gsc: { connected: true, sites: ['s'] },
    bing: { connected: false },
  },
  health_score: { score: 72, change_pct: 12.5, trend: 'up', label: 'Good' },
  pages: { audited: 10, avg_score: 66.5, needs_fix: 3, last_audit_at: '2026-09-10T00:00:00Z' },
  background_tasks: { overall_status: 'failing', failing_count: 1, max_consecutive_failures: 3, next_execution: '2026-09-14T00:00:00Z' },
  last_guardian_audit: { has_audit: true, content_quality: { score: 0.85 } },
  latest_strategic_insight: { generated_at: '2026-09-08T00:00:00Z', insights: { the_big_move: 'Competito r pivot' } },
  benchmark_status: { status: 'success', last_run: '2026-09-07T00:00:00Z' },
  last_updated: '2026-09-13T00:00:00Z',
  errors: [],
};

describe('Phase 8G — MainDashboard SEO summary card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the health score with the real trend delta and page signals', async () => {
    mockGet().mockResolvedValue({ data: CARD });
    render(<SeoSummaryCard />);
    await waitFor(() => expect(screen.getByText('72')).toBeInTheDocument());
    // delta surfaced with direction
    expect(screen.getByTestId('seo-summary-delta')).toHaveTextContent('+12.5%');
    // pages row
    expect(screen.getByTestId('seo-summary-pages')).toHaveTextContent('10');
    expect(screen.getByTestId('seo-summary-pages')).toHaveTextContent('3');
    // connections row
    expect(screen.getByTestId('seo-summary-platforms')).toHaveTextContent(/connected/i);
  });

  it('surfaces failing background tasks with an actionable alert', async () => {
    mockGet().mockResolvedValue({ data: CARD });
    render(<SeoSummaryCard />);
    await waitFor(() => expect(screen.getByTestId('seo-summary-tasks-alert')).toBeInTheDocument());
    expect(screen.getByTestId('seo-summary-tasks-alert')).toHaveTextContent(/failing|background task/i);
  });

  it('prompts GSC connect when the platform is disconnected', async () => {
    mockGet().mockResolvedValue({ data: CARD });
    render(<SeoSummaryCard />);
    await waitFor(() => expect(screen.getByRole('link', { name: /open seo dashboard/i })).toBeInTheDocument());
    expect(screen.getByTestId('seo-summary-gsc-connect')).toBeInTheDocument();
  });

  it('null state stays safe for fresh users (no fabricated zeros)', async () => {
    mockGet().mockResolvedValue({
      data: { ...CARD, has_data: false, health_score: { score: null, change_pct: null, trend: 'stable', label: null }, pages: { audited: 0, avg_score: null, needs_fix: 0, last_audit_at: null } },
    });
    render(<SeoSummaryCard />);
    await waitFor(() => expect(screen.getByText(/complete onboarding|no seo data/i)).toBeInTheDocument());
    expect(screen.queryByTestId('seo-summary-delta')).not.toBeInTheDocument();
  });

  it('error state shows a graceful fallback, never a crash', async () => {
    mockGet().mockRejectedValue(new Error('down'));
    render(<SeoSummaryCard />);
    await waitFor(() => expect(screen.getByText(/unable to load/i)).toBeInTheDocument());
  });

  it('polls the summary endpoint every 60 seconds (house cadence)', async () => {
    vi.useFakeTimers();
    try {
      mockGet().mockResolvedValue({ data: CARD });
      render(<SeoSummaryCard />);
      await vi.advanceTimersByTimeAsync(1);
      expect(mockGet()).toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(60_000);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockGet().mock.calls.length).toBeGreaterThanOrEqual(3);
      // ONE endpoint only — it composes, it does not stitch six calls
      expect(new Set(mockGet().mock.calls.map((c) => c[0])).size).toBe(1);
      expect(mockGet().mock.calls[0][0]).toBe('/api/seo-dashboard/seo-summary-card');
    } finally {
      vi.useRealTimers();
    }
  });

  it('mounts between ContentGuardianCard and AnalyticsInsights in the MainDashboard render tree', () => {
    const src = readFileSync(resolve(HERE, '../../MainDashboard.tsx'), 'utf-8');
    const iGuardian = src.indexOf('<ContentGuardianCard />');
    const iSummary = src.indexOf('<SeoSummaryCard />');
    const iAnalytics = src.indexOf('<AnalyticsInsights />');
    expect(iGuardian).toBeGreaterThanOrEqual(0);
    expect(iSummary).toBeGreaterThan(iGuardian);
    expect(iAnalytics).toBeGreaterThan(iSummary);
  });

  it('backend route for the card exists (contract)', () => {
    const src = readFileSync(
      resolve(HERE, '../../../../../../backend/app.py'),
      'utf-8',
    );
    expect(src).toContain('/api/seo-dashboard/seo-summary-card');
  });
});
