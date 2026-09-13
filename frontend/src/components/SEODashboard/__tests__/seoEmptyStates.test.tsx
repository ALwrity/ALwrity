import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import KeywordGapAnalysis from '../components/KeywordGapAnalysis';
import { apiClient } from '../../../api/client';

vi.mock('../../../api/client', () => ({
  apiClient: { get: vi.fn() },
}));

const HERE = dirname(fileURLToPath(import.meta.url));
const dashSrc = () =>
  readFileSync(resolve(HERE, '../SEODashboard.tsx'), 'utf-8');

describe('Phase 3C — no silent blanks, no duplicated sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a single Strategic Insights results section (no triple render)', () => {
    // ComingSoonSection owns its own id; the dashboard must not duplicate it.
    expect(dashSrc()).not.toMatch(/id="strategic-insights-results"/);
  });

  it('never mounts the mock-data SemanticInsights container (no live source)', () => {
    // The container hardcodes mockInsights with a TODO and no backend source
    // (/api/semantic-dashboard/data is not wired). Fail fast: unmounted until
    // a live source exists. SemanticHealthCard (real API) stays.
    const src = dashSrc();
    expect(src).not.toMatch(/<SemanticInsights/);
    expect(src).toMatch(/<SemanticHealthCard compact \/>/);
  });

  it('keyword gaps show an actionable empty state with retry instead of blank', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: null });
    render(<KeywordGapAnalysis />);
    await waitFor(() => {
      expect(screen.getByText(/no keyword data yet/i)).toBeInTheDocument();
    });
    const retry = screen.getByRole('button', { name: /retry/i });
    vi.mocked(apiClient.get).mockResolvedValue({ data: null });
    fireEvent.click(retry);
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
  });
});
